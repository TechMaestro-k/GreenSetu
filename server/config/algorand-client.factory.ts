import { algorandConfig, validateAlgorandConfig } from './algorand.config.js';

/**
 * Factory for creating AlgorandClient instances.
 * 
 * For now, we're using a simplified pattern that avoids direct AlgorandClient usage.
 * In production, you would properly initialize the AlgorandClient based on network.
 * 
 * The actual smart contract interactions will be handled through the ContractSupplyService.
 */

export function initializeAlgorandConfig(): void {
    validateAlgorandConfig();
    console.log('Algorand configuration initialized');
    console.log(`  Network: ${process.env.ALGORAND_NETWORK || 'localnet'}`);
    console.log(`  Node URL: ${algorandConfig.nodeUrl}`);
    console.log(`  Indexer URL: ${algorandConfig.indexerUrl}`);
}

/**
 * In production, this would return a properly configured AlgorandClient
 * For now, we rely on environment variables and the ContractSupplyService
 * to handle blockchain interactions.
 */
export function getAlgorandNetworkConfig() {
    return {
        nodeUrl: algorandConfig.nodeUrl,
        indexerUrl: algorandConfig.indexerUrl,
        contractAppId: algorandConfig.contractAppId,
    };
}
