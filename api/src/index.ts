import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const AMG_BASE_URL = (process.env.AMG_BASE_URL || 'https://test.amg.km').replace(/\/$/, '');
const MATCH_ENV = (process.env.AMG_TEST_POLICY_MATCH || 'TEST')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(s => s.length > 0);

app.use(cors());
app.use(express.json());
// Handle CORS preflight for all routes
app.options('*', cors());

function normalizePolicyStatus(status: unknown): string | null {
  if (status == null) return null;
  if (typeof status === 'string') return status.toUpperCase();
  const num = typeof status === 'number' ? status : Number(status);
  switch (num) {
    case 1: return 'ACTIVE';
    case 2: return 'DRAFT';
    case 3: return 'SUSPENDED';
    case 4: return 'EXPIRED';
    case 5: return 'CANCELLED';
    default: return null;
  }
}

function isOperationOutcomeNMissing(text: string): boolean {
  try {
    const obj = JSON.parse(text);
    if (obj && obj.resourceType === 'OperationOutcome' && Array.isArray(obj.issue)) {
      return obj.issue.some((iss: any) => String(iss?.details?.text || '').toLowerCase().includes('n is missing'));
    }
  } catch (_) {}
  return false;
}

async function amgLogin(): Promise<string> {
  const username = process.env.AMG_API_USERNAME;
  const password = process.env.AMG_API_PASSWORD;
  if (!username || !password) {
    throw new Error('AMG API credentials not configured');
  }
  const resp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AMG login failed: ${resp.status} ${t}`);
  }
  const json = await resp.json();
  const token = json.token || json.access_token;
  if (!token) throw new Error('No auth token received');
  return token as string;
}

async function fetchInsureeInquire(authToken: string, chfId: string): Promise<any | null> {
  try {
    const gqlQuery = `query GetInsureeInquire($chfId: String) {\n      insurees(chfId: $chfId, ignoreLocation: true) {\n        edges { node {\n          chfId lastName otherNames dob gender { gender }\n          photos { folder filename photo }\n          insureePolicies { edges { node {\n            policy {\n              product { name code ceiling ceilingIp ceilingOp deductible deductibleIp deductibleOp\n                maxNoAntenatal maxAmountAntenatal maxNoSurgery maxAmountSurgery maxNoConsultation maxAmountConsultation\n                maxNoDelivery maxAmountDelivery maxNoHospitalization maxAmountHospitalization maxMembers maxNoVisits maxInstallments\n                maxCeilingPolicy maxCeilingPolicyIp maxCeilingPolicyOp maxPolicyExtraMember maxPolicyExtraMemberIp maxPolicyExtraMemberOp\n              }\n              enrollDate expiryDate status value validityTo\n            }\n          } } }\n        } }\n      }\n    }`;
    const resp = await fetch(`${AMG_BASE_URL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ query: gqlQuery, variables: { chfId } }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn(`[verify-insurance] GraphQL insurees error: ${txt}`);
      return null;
    }
    const json = await resp.json();
    const node = json?.data?.insurees?.edges?.[0]?.node || null;
    return node || null;
  } catch (e: any) {
    console.warn('[verify-insurance] GraphQL insurees exception', e?.message || String(e));
    return null;
  }
}

app.post('/api/auth/verify-insurance', async (req: Request, res: Response) => {
  try {
    const { insuranceNumber } = req.body || {};
    if (!insuranceNumber || typeof insuranceNumber !== 'string') {
      return res.status(400).json({ error: 'Insurance number is required' });
    }
    console.log(`[verify-insurance] Start, insuranceNumber=${insuranceNumber}`);

    const authToken = await amgLogin();

    // Patient (search by identifier)
    const patientResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Patient?identifier=${encodeURIComponent(insuranceNumber)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    });
    let patientData: any = null;
    if (!patientResp.ok) {
      const t = await patientResp.text();
      console.warn(`[verify-insurance] Patient search by identifier failed: ${patientResp.status} ${t}`);
      // Fallback even when identifier search errors: try direct Patient/{id}
      console.log('[verify-insurance] Fallback → direct Patient/{id} lookup');
      const patientByIdResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Patient/${encodeURIComponent(insuranceNumber)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      });
      if (!patientByIdResp.ok) {
        const t2 = await patientByIdResp.text();
        console.warn(`[verify-insurance] Patient ID lookup failed: ${patientByIdResp.status} ${t2}`);
        // If AMG returns 400/404 or 500 OperationOutcome("N is missing"), try GraphQL insurees fallback
        if (patientByIdResp.status === 400 || patientByIdResp.status === 404 || (patientByIdResp.status === 500 && isOperationOutcomeNMissing(t2))) {
          const insureeNode = await fetchInsureeInquire(authToken, insuranceNumber);
          if (insureeNode) {
            // Build minimal policy info from insureePolicies
            const firstPolicyNode = insureeNode?.insureePolicies?.edges?.[0]?.node?.policy || null;
            let policyDataLocal: any = null;
            let policyStatusLocal: string | null = null;
            let policyDatesLocal = { startDate: null as string | null, effectiveDate: null as string | null, expiryDate: null as string | null };
            let groupStatusLocal: 'active' | 'inactive' | 'pending' | 'unknown' = 'unknown';
            let groupReasonLocal: string | null = null;
            if (firstPolicyNode) {
              policyDataLocal = firstPolicyNode;
              policyStatusLocal = normalizePolicyStatus(firstPolicyNode.status);
              const enroll = firstPolicyNode.enrollDate || null;
              const expiry = firstPolicyNode.expiryDate || null;
              policyDatesLocal = { startDate: enroll, effectiveDate: enroll, expiryDate: expiry };
              const nowG = new Date();
              const startStrG = enroll;
              const startG = startStrG ? new Date(startStrG) : null;
              const endG = expiry ? new Date(expiry) : null;
              const inWindowG = !!(startG && endG && nowG >= startG && nowG <= endG);
              if (inWindowG) {
                if (policyStatusLocal === 'ACTIVE' || policyStatusLocal === 'DRAFT' || (!policyStatusLocal && policyDataLocal)) {
                  groupStatusLocal = 'active';
                  groupReasonLocal = policyStatusLocal === 'ACTIVE' ? 'fallback_group_active_in_window' : (policyStatusLocal === 'DRAFT' ? 'fallback_group_draft_in_window' : 'fallback_group_policy_in_window');
                } else if (['READY','PENDING'].includes(policyStatusLocal || '')) {
                  groupStatusLocal = 'pending';
                  groupReasonLocal = 'fallback_group_pending_status';
                } else if (['EXPIRED','SUSPENDED','CANCELLED'].includes(policyStatusLocal || '')) {
                  groupStatusLocal = 'inactive';
                  groupReasonLocal = 'fallback_group_inactive_status';
                } else {
                  groupStatusLocal = 'unknown';
                  groupReasonLocal = 'fallback_group_unknown';
                }
              } else {
                groupStatusLocal = 'inactive';
                groupReasonLocal = 'fallback_group_out_of_window';
              }
            }
            const fallbackFullName = `${insureeNode.otherNames || ''} ${insureeNode.lastName || ''}`.trim() || null;
            // Environment guard
            const productName = String((policyDataLocal && policyDataLocal.product?.name) || '').toUpperCase();
            const productCode = String((policyDataLocal && policyDataLocal.product?.code) || '').toUpperCase();
            const planName = '';
            const bypassEnvGuard = MATCH_ENV.includes('*') || MATCH_ENV.includes('ANY');
            const envAllowed = bypassEnvGuard || MATCH_ENV.some(p => (productName.includes(p) || productCode.includes(p) || planName.includes(p)));
            console.log(`[verify-insurance] Env guard (GraphQL fallback): MATCH_ENV=${JSON.stringify(MATCH_ENV)} bypass=${bypassEnvGuard} productName='${productName}' productCode='${productCode}' => allowed=${envAllowed}`);
            // Ne pas bloquer la connexion si le produit/couverture sont absents.
            // On poursuit et on renvoie exists:true avec un coverageStatus adapté.
            // Coverage status estimation from policy
            let coverageStatus: 'active' | 'inactive' | 'pending' = 'inactive';
            let coverageReason = 'unknown';
            const now = new Date();
            const startDateStr = policyDatesLocal.startDate || policyDatesLocal.effectiveDate;
            const start = startDateStr ? new Date(startDateStr) : null;
            const end = policyDatesLocal.expiryDate ? new Date(policyDatesLocal.expiryDate) : null;
            const inWindow = !!(start && end && now >= start && now <= end);
            if (inWindow) {
              if (policyStatusLocal === 'ACTIVE' || policyStatusLocal === 'DRAFT' || (!policyStatusLocal && policyDataLocal)) {
                coverageStatus = 'active';
                coverageReason = policyStatusLocal === 'ACTIVE' ? 'graphql_fallback_active_in_window' : (policyStatusLocal === 'DRAFT' ? 'graphql_fallback_draft_in_window' : 'fallback_insuree_policy_in_window');
              } else if (['READY', 'PENDING'].includes(policyStatusLocal || '')) {
                coverageStatus = 'pending';
                coverageReason = 'graphql_fallback_pending_status';
              } else if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatusLocal || '')) {
                coverageStatus = 'inactive';
                coverageReason = 'graphql_fallback_inactive_status';
              }
            } else {
              if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatusLocal || '')) {
                coverageStatus = 'inactive';
                coverageReason = 'graphql_fallback_inactive_status';
              } else if (['READY', 'PENDING', 'DRAFT'].includes(policyStatusLocal || '')) {
                coverageStatus = 'pending';
                coverageReason = 'graphql_fallback_pending_status';
              }
            }
            // Hard guard: if product does not match environment (e.g., not AMG) or no policy data,
            // force coverage to inactive to avoid showing false positives.
            if (!envAllowed || !policyDataLocal) {
              coverageStatus = 'inactive';
              coverageReason = !policyDataLocal ? 'no_group_policy' : 'no_amg_coverage';
            }
            // If group policy is missing, present group as inactive for clarity.
            if (groupStatusLocal === 'unknown' && groupReasonLocal === 'fallback_group_unknown' || groupReasonLocal === 'no_group_policy') {
              groupStatusLocal = 'inactive';
              groupReasonLocal = groupReasonLocal || 'no_group_policy';
            }
            console.log(`[verify-insurance] GraphQL fallback success for ${insuranceNumber} coverageStatus=${coverageStatus}`);
            return res.status(200).json({
              exists: true,
              patientData: null,
              coverageData: null,
              contractData: { entry: [] },
              insurancePlanData: null,
              invoicesData: null,
              totalUnpaidAmount: 0,
              fullName: fallbackFullName || 'Unknown',
              coverageStatus,
              coverageReason,
              policyStatus: policyStatusLocal,
              policyDates: policyDatesLocal,
              policyData: policyDataLocal,
              policyErrorText: null,
              groupId: null,
              familyUuidUsed: null,
              groupStatus: groupStatusLocal,
              groupReason: groupReasonLocal,
              groupProductName: (policyDataLocal && policyDataLocal.product?.name) || null,
              groupProductCode: (policyDataLocal && policyDataLocal.product?.code) || null,
            });
          }
          return res.status(200).json({ exists: false, details: t2 });
        }
        return res.status(500).json({ error: 'Failed to verify insurance number', details: t2 });
      }
      const patientByIdData = await patientByIdResp.json();
      if (patientByIdData?.resourceType !== 'Patient') {
        console.warn(`[verify-insurance] Resource returned is not Patient for id=${insuranceNumber}`);
        return res.status(200).json({ exists: false });
      }
      patientData = patientByIdData;
    }
    const patientBundle = await patientResp.json();
    const patientEntry = Array.isArray(patientBundle.entry) ? patientBundle.entry[0] : null;
    patientData = patientData || patientEntry?.resource || null;
    if (!patientData || patientData.resourceType !== 'Patient') {
      console.warn(`[verify-insurance] No patient found for identifier ${insuranceNumber}, trying direct ID lookup`);
      const patientByIdResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Patient/${encodeURIComponent(insuranceNumber)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      });
      if (patientByIdResp.ok) {
        const patientByIdData = await patientByIdResp.json();
        if (patientByIdData?.resourceType === 'Patient') {
          patientData = patientByIdData;
        }
      }
      if (!patientData || patientData.resourceType !== 'Patient') {
        console.warn(`[verify-insurance] Patient not found by identifier or ID for ${insuranceNumber}`);
        return res.status(200).json({ exists: false });
      }
    }
    console.log(`[verify-insurance] Patient OK id=${patientData.id}`);

    // Coverage
    let coverageData: any = null;
    const coverageResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Coverage/?beneficiary=Patient/${patientData.id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    });
    if (coverageResp.ok) {
      coverageData = await coverageResp.json();
      const planNameLog = String((coverageData?.entry?.[0]?.resource?.class?.[0]?.value) || '');
      console.log(`[verify-insurance] Coverage fetched, planName='${planNameLog}'`);
    }

    // Group reference → familyUuid candidate
    let groupId: string | null = null;
    let familyUuidForGraphQL: string | null = null;
    try {
      const groupExtension = Array.isArray(patientData.extension)
        ? patientData.extension.find((ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/patient-group-reference')
        : null;
      const refStr: string | undefined = groupExtension?.valueReference?.reference;
      const idCandidate = refStr ? (refStr.includes('/') ? refStr.split('/')[1] : refStr) : groupExtension?.valueReference?.identifier?.value;
      groupId = idCandidate || null;
      if (groupId) {
        const groupResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Group/${groupId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        });
        if (groupResp.ok) {
          const groupJson = await groupResp.json();
          const identifiers: any[] = Array.isArray(groupJson.identifier) ? groupJson.identifier : [];
          const bySystem = identifiers.find((id: any) => typeof id.system === 'string' && /uuid|family/i.test(id.system));
          const byTypeCode = identifiers.find((id: any) => id.type?.coding?.some((c: any) => /uuid|family/i.test(c.code || '')));
          const candidate = bySystem?.value || byTypeCode?.value || null;
          familyUuidForGraphQL = candidate || (typeof groupJson.id === 'string' ? groupJson.id : null);
        }
      }
    } catch (_) {}

    // GraphQL policy
    let policyStatus: string | null = null;
    let policyDates: { startDate: string | null; effectiveDate: string | null; expiryDate: string | null } = {
      startDate: null, effectiveDate: null, expiryDate: null
    };
    let policyData: any = null;
    let policyErrorText: string | null = null;
    // Group status derived from family policy
    let groupStatus: 'active' | 'inactive' | 'pending' | 'unknown' = 'unknown';
    let groupReason: string | null = null;
    if (familyUuidForGraphQL) {
      try {
        const gqlResp = await fetch(`${AMG_BASE_URL}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({
            query: `query GetPolicies($familyUuid: String!) {\n              policiesByFamily(activeOrLastExpiredOnly: true, familyUuid: $familyUuid) {\n                edges { node {\n                  policyUuid status startDate effectiveDate expiryDate productCode productName policyValue\n                } }\n              }\n            }`,
            variables: { familyUuid: familyUuidForGraphQL }
          }),
        });
        if (gqlResp.ok) {
          const gql = await gqlResp.json();
          const node = gql?.data?.policiesByFamily?.edges?.[0]?.node || null;
          if (node) {
            policyData = node;
            policyStatus = normalizePolicyStatus(node.status);
            policyDates = {
              startDate: node.startDate || null,
              effectiveDate: node.effectiveDate || null,
              expiryDate: node.expiryDate || null,
            };
            console.log(`[verify-insurance] GraphQL policy: code='${node.productCode}' name='${node.productName}' status='${policyStatus}' dates=${JSON.stringify(policyDates)}`);
            // Compute group status based on policy dates/status
            const nowGroup = new Date();
            const startStrG = policyDates.startDate || policyDates.effectiveDate;
            const startG = startStrG ? new Date(startStrG) : null;
            const endG = policyDates.expiryDate ? new Date(policyDates.expiryDate) : null;
            const windowG = !!(startG && endG && nowGroup >= startG && nowGroup <= endG);
            if (windowG) {
              if (policyStatus === 'ACTIVE' || policyStatus === 'DRAFT' || (!policyStatus && policyData)) {
                groupStatus = 'active';
                groupReason = policyStatus === 'ACTIVE' ? 'group_active_in_window' : (policyStatus === 'DRAFT' ? 'group_draft_in_window' : 'group_policy_in_window');
              } else if (['READY','PENDING'].includes(policyStatus || '')) {
                groupStatus = 'pending';
                groupReason = 'group_pending_status';
              } else if (['EXPIRED','SUSPENDED','CANCELLED'].includes(policyStatus || '')) {
                groupStatus = 'inactive';
                groupReason = 'group_inactive_status';
              } else {
                groupStatus = 'unknown';
                groupReason = 'group_unknown';
              }
            } else {
              groupStatus = 'inactive';
              groupReason = 'group_out_of_window';
            }
          } else {
            policyErrorText = JSON.stringify({ message: 'No policy found', familyUuid: familyUuidForGraphQL, response: gql });
            console.warn(`[verify-insurance] No policy found for familyUuid=${familyUuidForGraphQL}`);
            groupStatus = 'unknown';
            groupReason = 'no_group_policy';
          }
        } else {
          policyErrorText = await gqlResp.text();
          console.warn(`[verify-insurance] GraphQL error: ${policyErrorText}`);
        }
      } catch (e: any) {
        policyErrorText = e?.message || String(e);
        console.error(`[verify-insurance] GraphQL exception: ${policyErrorText}`);
      }
    }

    // Fallback coverage for dates
    if (!policyStatus && (!policyDates.startDate && !policyDates.effectiveDate && !policyDates.expiryDate)) {
      try {
        const covResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Coverage?beneficiary=Patient/${patientData.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        });
        if (covResp.ok) {
          const cov = await covResp.json();
          const entry = Array.isArray(cov.entry) ? cov.entry[0] : null;
          const resource = entry?.resource || null;
          if (resource) {
            const statusVal = resource.status || null;
            const period = resource.period || {};
            const startStr = period.start || null;
            const endStr = period.end || null;
            policyStatus = normalizePolicyStatus(statusVal) || policyStatus;
            policyDates = { startDate: startStr, effectiveDate: startStr, expiryDate: endStr };
          }
        }
      } catch (_) {}
    }

    // Invoices total
    let invoicesData: any = null;
    let totalUnpaidAmount = 0;
    const invResp = await fetch(`${AMG_BASE_URL}/api/api_fhir_r4/Invoice/?subject=Patient/${patientData.id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    });
    if (invResp.ok) {
      invoicesData = await invResp.json();
      if (Array.isArray(invoicesData.entry)) {
        for (const e of invoicesData.entry) {
          const invoice = e.resource;
          if (invoice.status !== 'balanced' && invoice.status !== 'cancelled') {
            const amount = invoice.totalNet?.value || invoice.totalGross?.value || 0;
            totalUnpaidAmount += Number(amount || 0);
          }
        }
      }
    }

    // Environment guard
    const productName = String((policyData && policyData.productName) || '').toUpperCase();
    const productCode = String((policyData && policyData.productCode) || '').toUpperCase();
    const planName = String((coverageData?.entry?.[0]?.resource?.class?.[0]?.value) || '').toUpperCase();
    const bypassEnvGuard = MATCH_ENV.includes('*') || MATCH_ENV.includes('ANY');
    const envAllowed = bypassEnvGuard || MATCH_ENV.some(p => (productName.includes(p) || productCode.includes(p) || planName.includes(p)));
    console.log(`[verify-insurance] Env guard check: MATCH_ENV=${JSON.stringify(MATCH_ENV)} bypass=${bypassEnvGuard} productName='${productName}' productCode='${productCode}' planName='${planName}' => allowed=${envAllowed}`);
    // Ne pas bloquer la connexion en absence de correspondance; continuer et indiquer la couverture.

    // Coverage status
    let coverageStatus: 'active' | 'inactive' | 'pending' = 'inactive';
    let coverageReason = 'unknown';
    const now = new Date();
    const startDateStr = policyDates.startDate || policyDates.effectiveDate;
    const start = startDateStr ? new Date(startDateStr) : null;
    const end = policyDates.expiryDate ? new Date(policyDates.expiryDate) : null;
    const inWindow = !!(start && end && now >= start && now <= end);
    if (inWindow) {
      if (policyStatus === 'ACTIVE' || policyStatus === 'DRAFT' || (!policyStatus && policyData)) {
        coverageStatus = 'active';
        coverageReason = policyStatus === 'ACTIVE' ? 'graphql_active_in_window' : (policyStatus === 'DRAFT' ? 'graphql_draft_in_window' : 'group_policy_in_window');
      } else if (['READY', 'PENDING'].includes(policyStatus || '')) {
        coverageStatus = 'pending';
        coverageReason = 'graphql_pending_status';
      } else if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatus || '')) {
        coverageStatus = 'inactive';
        coverageReason = 'graphql_inactive_status';
      }
    } else {
      // out of window or unknown dates
      if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatus || '')) {
        coverageStatus = 'inactive';
        coverageReason = 'graphql_inactive_status';
      } else if (['READY', 'PENDING', 'DRAFT'].includes(policyStatus || '')) {
        coverageStatus = 'pending';
        coverageReason = 'graphql_pending_status';
      }
    }

    // Hard guard: only consider allowed products (e.g., AMG). If not allowed or no policy,
    // force coverage to inactive to avoid false "active" statuses.
    if (!envAllowed || !policyData) {
      coverageStatus = 'inactive';
      coverageReason = !policyData ? 'no_group_policy' : 'no_amg_coverage';
    }
    // If group policy is missing, show group as inactive for clarity.
    if (groupStatus === 'unknown' && (groupReason === 'group_unknown' || groupReason === 'no_group_policy')) {
      groupStatus = 'inactive';
      groupReason = groupReason || 'no_group_policy';
    }

    const fullName = patientData?.name?.[0]
      ? `${patientData.name[0].given?.[0] || ''} ${patientData.name[0].family || ''}`.trim()
      : 'Unknown';

    console.log(`[verify-insurance] Success for ${insuranceNumber} coverageStatus=${coverageStatus}`);
    return res.status(200).json({
      exists: true,
      patientData,
      coverageData,
      contractData: { entry: [] },
      insurancePlanData: null,
      invoicesData,
      totalUnpaidAmount,
      fullName,
      coverageStatus,
      coverageReason,
      policyStatus,
      policyDates,
      policyData,
      policyErrorText,
      groupId,
      familyUuidUsed: familyUuidForGraphQL,
      groupStatus,
      groupReason,
      groupProductName: (policyData && policyData.productName) || null,
      groupProductCode: (policyData && policyData.productCode) || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error', details: error?.message || String(error) });
  }
});

// HOLO payment init (stub for test environment)
app.post('/api/holo/init-payment', async (req: Request, res: Response) => {
  try {
    const { amount, insuranceNumber, operator } = req.body || {};
    const amt = Number(amount || 0);
    const op = String(operator || 'holo').toLowerCase();
    if (!insuranceNumber || typeof insuranceNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'insuranceNumber is required' });
    }
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be > 0' });
    }

    const mode = (process.env.HOLO_MODE || 'test').toLowerCase();
    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:8080';

    if (mode !== 'production') {
      // Test/stub mode: immediate success redirect to frontend
      const redirectUrl = `${frontendBase}/payment-result?status=success&operator=${encodeURIComponent(op)}&ref=${encodeURIComponent(insuranceNumber)}`;
      console.log(`[holo-init-payment] [test] Simulating payment: insurance=${insuranceNumber} amount=${amt} operator=${op}`);
      return res.status(200).json({ success: true, testMode: true, redirectUrl });
    }

    // Production mode: return HOLO gateway URL + parameters for POST form submission
    const paymentUrl = process.env.HOLO_PAYMENT_URL || '';
    const merchantId = process.env.HOLO_MERCHANT_ID || '';
    const callbackUrl = `${frontendBase}/payment-result?operator=${encodeURIComponent(op)}`;

    if (!paymentUrl || !merchantId) {
      return res.status(500).json({ success: false, error: 'HOLO payment not configured (HOLO_PAYMENT_URL, HOLO_MERCHANT_ID)' });
    }

    const paymentParams: Record<string, string | number> = {
      merchantId,
      amount: amt,
      reference: insuranceNumber,
      currency: 'KMF',
      callbackUrl,
      operator: op,
      // signature: <compute signature here if required by HOLO>
    };

    console.log('[holo-init-payment] [prod] Returning payment form params for HOLO gateway');
    return res.status(200).json({ success: true, paymentUrl, paymentParams });
  } catch (e: any) {
    console.error('[holo-init-payment] Error', e?.message || String(e));
    return res.status(500).json({ success: false, error: e?.message || 'Unexpected error' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});