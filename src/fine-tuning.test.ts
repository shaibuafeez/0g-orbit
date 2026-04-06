import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NETWORKS } from './networks.js'
import { FineTuningError } from './errors.js'

// Hoist mocks so they can be referenced in vi.mock factories
const {
    mockListModel,
    mockListService,
    mockListTask,
    mockGetTask,
    mockGetLog,
    mockCreateTask,
    mockAcknowledgeModel,
    mockAcknowledgeProviderSigner,
    mockStore,
} = vi.hoisted(() => ({
    mockListModel: vi.fn(),
    mockListService: vi.fn(),
    mockListTask: vi.fn(),
    mockGetTask: vi.fn(),
    mockGetLog: vi.fn(),
    mockCreateTask: vi.fn(),
    mockAcknowledgeModel: vi.fn(),
    mockAcknowledgeProviderSigner: vi.fn(),
    mockStore: vi.fn(),
}))

vi.mock('@0glabs/0g-serving-broker', () => ({
    createZGComputeNetworkBroker: vi.fn().mockResolvedValue({
        fineTuning: {
            listModel: mockListModel,
            listService: mockListService,
            listTask: mockListTask,
            getTask: mockGetTask,
            getLog: mockGetLog,
            createTask: mockCreateTask,
            acknowledgeModel: mockAcknowledgeModel,
            acknowledgeProviderSigner: mockAcknowledgeProviderSigner,
        },
        ledger: {
            getLedger: vi.fn(),
            addLedger: vi.fn(),
        },
        inference: {},
    }),
}))

vi.mock('./storage.js', () => ({
    StorageClient: vi.fn().mockImplementation(() => ({
        store: mockStore,
    })),
}))

import { FineTuningClient } from './fine-tuning.js'
import { StorageClient } from './storage.js'

const mockWallet = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    privateKey: '0xdeadbeef',
} as any
const testNetwork = { ...NETWORKS.testnet }
const mockStorageClient = new StorageClient(testNetwork, mockWallet)

describe('FineTuningClient', () => {
    let client: FineTuningClient

    beforeEach(() => {
        vi.clearAllMocks()
        client = new FineTuningClient(testNetwork, mockWallet, mockStorageClient)
    })

    describe('lazy broker init', () => {
        it('initializes broker on first call', async () => {
            mockListModel.mockResolvedValueOnce([[], []])

            await client.listModels()
            const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker')
            expect(createZGComputeNetworkBroker).toHaveBeenCalledTimes(1)
        })

        it('reuses broker on subsequent calls', async () => {
            mockListModel.mockResolvedValue([[], []])

            await client.listModels()
            await client.listModels()
            const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker')
            expect(createZGComputeNetworkBroker).toHaveBeenCalledTimes(1)
        })

        it('throws FineTuningError on broker init failure', async () => {
            const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker')
            ;(createZGComputeNetworkBroker as any).mockRejectedValueOnce(
                new Error('Network unreachable')
            )

            const freshClient = new FineTuningClient(testNetwork, mockWallet, mockStorageClient)
            try {
                await freshClient.listModels()
                expect.unreachable('Should have thrown')
            } catch (err) {
                expect(err).toBeInstanceOf(FineTuningError)
                expect((err as FineTuningError).message).toContain('Failed to initialize')
            }
        })
    })

    describe('uploadDataset', () => {
        it('uploads a dataset and returns root + tx hash', async () => {
            mockStore.mockResolvedValueOnce({
                root: '0xdataset_root',
                txHash: '0xtx_hash',
            })

            const result = await client.uploadDataset('/tmp/dataset.jsonl')
            expect(result.root).toBe('0xdataset_root')
            expect(result.txHash).toBe('0xtx_hash')
            expect(mockStore).toHaveBeenCalledWith('/tmp/dataset.jsonl')
        })

        it('throws FineTuningError on file error', async () => {
            mockStore.mockRejectedValueOnce(new Error('ENOENT: no such file'))

            await expect(client.uploadDataset('/tmp/missing.jsonl')).rejects.toThrow(
                FineTuningError
            )
        })
    })

    describe('createTask', () => {
        it('creates a fine-tuning task', async () => {
            mockAcknowledgeProviderSigner.mockResolvedValueOnce(undefined)
            mockCreateTask.mockResolvedValueOnce('task-001')

            const task = await client.createTask({
                model: 'Qwen2.5-0.5B-Instruct',
                dataset: '0xdataset_root',
                providerAddress: '0xprovider',
            })

            expect(task.id).toBe('task-001')
            expect(task.model).toBe('Qwen2.5-0.5B-Instruct')
            expect(task.dataset).toBe('0xdataset_root')
            expect(task.provider).toBe('0xprovider')
            expect(task.status).toBe('init')
        })

        it('throws FineTuningError on invalid model', async () => {
            mockAcknowledgeProviderSigner.mockResolvedValueOnce(undefined)
            mockCreateTask.mockRejectedValueOnce(new Error('Model not found'))

            await expect(
                client.createTask({
                    model: 'nonexistent-model',
                    dataset: '0xdataset_root',
                    providerAddress: '0xprovider',
                })
            ).rejects.toThrow(FineTuningError)
        })

        it('throws FineTuningError on missing provider', async () => {
            mockAcknowledgeProviderSigner.mockRejectedValueOnce(
                new Error('Provider not found')
            )

            await expect(
                client.createTask({
                    model: 'Qwen2.5-0.5B-Instruct',
                    dataset: '0xdataset_root',
                    providerAddress: '0xbad_provider',
                })
            ).rejects.toThrow(FineTuningError)
        })
    })

    describe('getTask', () => {
        it('returns a task by ID', async () => {
            mockGetTask.mockResolvedValueOnce({
                id: 'task-001',
                preTrainedModelHash: '0xmodel',
                datasetHash: '0xdata',
                progress: 'Training',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-02',
            })

            const task = await client.getTask('0xprovider', 'task-001')
            expect(task.id).toBe('task-001')
            expect(task.status).toBe('training')
            expect(task.provider).toBe('0xprovider')
        })

        it('throws FineTuningError when task not found', async () => {
            mockGetTask.mockRejectedValueOnce(new Error('No task found'))

            await expect(
                client.getTask('0xprovider', 'nonexistent')
            ).rejects.toThrow(FineTuningError)
        })
    })

    describe('getTaskLog', () => {
        it('returns the training log', async () => {
            mockGetLog.mockResolvedValueOnce('Epoch 1/3: loss=0.5\nEpoch 2/3: loss=0.3')

            const log = await client.getTaskLog('0xprovider', 'task-001')
            expect(log).toContain('Epoch 1/3')
        })
    })

    describe('listTasks', () => {
        it('returns all tasks for a provider', async () => {
            mockListTask.mockResolvedValueOnce([
                { id: 'task-001', preTrainedModelHash: '0xm1', datasetHash: '0xd1', progress: 'Finished' },
                { id: 'task-002', preTrainedModelHash: '0xm2', datasetHash: '0xd2', progress: 'Training' },
            ])

            const tasks = await client.listTasks('0xprovider')
            expect(tasks).toHaveLength(2)
            expect(tasks[0].status).toBe('finished')
            expect(tasks[1].status).toBe('training')
        })
    })

    describe('downloadModel', () => {
        it('downloads a model via acknowledgeModel', async () => {
            mockAcknowledgeModel.mockResolvedValueOnce(undefined)

            await expect(
                client.downloadModel('0xprovider', 'task-001', '/tmp/model')
            ).resolves.toBeUndefined()

            expect(mockAcknowledgeModel).toHaveBeenCalledWith(
                '0xprovider',
                'task-001',
                '/tmp/model'
            )
        })

        it('throws FineTuningError when task not ready', async () => {
            mockAcknowledgeModel.mockRejectedValueOnce(
                new Error('No deliverable found')
            )

            await expect(
                client.downloadModel('0xprovider', 'task-001', '/tmp/model')
            ).rejects.toThrow(FineTuningError)
        })
    })

    describe('listModels', () => {
        it('returns combined standard and customized models', async () => {
            mockListModel.mockResolvedValueOnce([
                [['Qwen2.5-0.5B-Instruct', { turbo: '0xhash', description: 'Qwen model' }]],
                [['my-custom', { description: 'Custom fine-tuned', provider: '0xp1' }]],
            ])

            const models = await client.listModels()
            expect(models).toHaveLength(2)
            expect(models[0].name).toBe('Qwen2.5-0.5B-Instruct')
            expect(models[1].name).toBe('my-custom')
            expect(models[1].config.provider).toBe('0xp1')
        })

        it('returns empty array when no models', async () => {
            mockListModel.mockResolvedValueOnce([[], []])

            const models = await client.listModels()
            expect(models).toHaveLength(0)
        })
    })

    describe('listProviders', () => {
        it('returns fine-tuning providers', async () => {
            mockListService.mockResolvedValueOnce([
                { provider: '0xprovider1', url: 'https://p1.example.com', models: ['model1'] },
                { provider: '0xprovider2', url: 'https://p2.example.com', models: [] },
            ])

            const providers = await client.listProviders()
            expect(providers).toHaveLength(2)
            expect(providers[0].address).toBe('0xprovider1')
            expect(providers[0].url).toBe('https://p1.example.com')
            expect(providers[0].models).toEqual(['model1'])
        })
    })

    describe('error suggestions', () => {
        it('FineTuningError includes default suggestion', () => {
            const err = new FineTuningError('Something failed')
            expect(err.code).toBe('FINE_TUNING_ERROR')
            expect(err.suggestion).toContain('listModels')
        })

        it('FineTuningError allows custom suggestion', () => {
            const err = new FineTuningError('Oops', 'Try this instead')
            expect(err.suggestion).toBe('Try this instead')
        })
    })
})
