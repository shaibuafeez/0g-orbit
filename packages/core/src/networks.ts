export type NetworkName = 'testnet' | 'mainnet'

export interface NetworkConfig {
    name: NetworkName
    chainId: bigint
    rpcUrl: string
    /** Fallback RPC URLs, tried in order if the primary fails */
    rpcUrls: string[]
    indexerUrl: string
    flowContractAddress: string
    ledgerContractAddress: string
    inferenceContractAddress: string
    fineTuningContractAddress: string
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
    testnet: {
        name: 'testnet',
        chainId: 16602n,
        rpcUrl: 'https://evmrpc-testnet.0g.ai',
        rpcUrls: [
            'https://evmrpc-testnet.0g.ai',
            'https://16600-rpc.testnet.0g.ai',
            'https://og-testnet-evm-rpc.allthatnode.com',
        ],
        indexerUrl: 'https://indexer-storage-testnet-turbo.0g.ai',
        flowContractAddress: '0xbD2C3F0E65eDF5582141C35969d66e34e4E6BF80',
        ledgerContractAddress: '0xE70830508dAc0A97e6c087c75f402f9Be669E406',
        inferenceContractAddress: '0xa79F4c8311FF93C06b8CfB403690cc987c93F91E',
        fineTuningContractAddress: '0xC6C075D8039763C8f1EbE580be5ADdf2fd6941bA',
    },
    mainnet: {
        name: 'mainnet',
        chainId: 16661n,
        rpcUrl: 'https://evmrpc.0g.ai',
        rpcUrls: [
            'https://evmrpc.0g.ai',
            'https://0g-rpc-evm01.validatorvn.com',
            'https://rpc.0g.thirdweb.com',
        ],
        indexerUrl: 'https://indexer-storage.0g.ai',
        flowContractAddress: '0x0460aA47b41a66694c0a73f667a1b795A5ED3556',
        ledgerContractAddress: '0x2dE54c845Cd948B72D2e32e39586fe89607074E3',
        inferenceContractAddress: '0x47340d900bdFec2BD393c626E12ea0656F938d84',
        fineTuningContractAddress: '0x4e3474095518883744ddf135b7E0A23301c7F9c0',
    },
}

export function getNetwork(nameOrChainId: NetworkName | bigint): NetworkConfig {
    if (typeof nameOrChainId === 'string') {
        const config = NETWORKS[nameOrChainId]
        if (!config) throw new Error(`Unknown network: ${nameOrChainId}`)
        // Return a copy so overrides don't mutate the original
        return { ...config, rpcUrls: [...config.rpcUrls] }
    }
    for (const config of Object.values(NETWORKS)) {
        if (config.chainId === nameOrChainId) {
            return { ...config, rpcUrls: [...config.rpcUrls] }
        }
    }
    throw new Error(`Unknown chain ID: ${nameOrChainId}`)
}
