import { ContractSupplyService } from '../services/contract-supply.service.js';

const batch = process.argv[2] || '10';

(async () => {
    const service = new ContractSupplyService();
    console.log(`\n🔍 Checking verification for batch ${batch}...\n`);

    const rec = await service.getVerificationRecord(batch);

    if (rec) {
        console.log('✅ Verification found:');
        console.log(JSON.stringify(rec, null, 2));
    } else {
        console.log('❌ No verification found for this batch');
        console.log('\nChecking if batch exists...');
        const exists = await service.hasBatch(batch);
        console.log(`Batch exists: ${exists}`);
    }
})();
