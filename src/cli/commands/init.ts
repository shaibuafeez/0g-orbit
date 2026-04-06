import chalk from 'chalk'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface InitOpts {
    template: string
    dir: string
}

export async function initCommand(opts: InitOpts) {
    const dir = resolve(opts.dir)

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }

    // Create package.json
    const pkg = {
        name: 'my-0g-app',
        version: '0.1.0',
        type: 'module',
        scripts: {
            start: 'node index.js',
        },
        dependencies: {
            '0g-orbit': '^0.1.0',
        },
    }
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

    // Create index.js with example
    const example = `import { Orbit } from '0g-orbit'

const orbit = await Orbit.connect({
    network: 'testnet',
    privateKey: process.env.PRIVATE_KEY,
})

// Check account status
const status = await orbit.status()
console.log(\`Connected: \${status.address} on \${status.network}\`)
console.log(\`Balance: \${status.balance} OG\`)

// Upload a file
// const { root } = await orbit.store('./my-file.txt')
// console.log('Stored at:', root)

// Run inference
// const result = await orbit.infer('meta-llama/Llama-3.3-70B', {
//     messages: [{ role: 'user', content: 'What is 0G?' }],
// })
// console.log(result.content)
`
    writeFileSync(join(dir, 'index.js'), example)

    // Create .env.example
    writeFileSync(join(dir, '.env.example'), 'PRIVATE_KEY=0x...\n')

    // Create .gitignore
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n')

    console.log()
    console.log(chalk.bold('  0G Orbit project initialized'))
    console.log()
    console.log(chalk.dim('  Next steps:'))
    console.log(`  1. ${chalk.cyan('cd ' + (opts.dir === '.' ? '.' : opts.dir))}`)
    console.log(`  2. ${chalk.cyan('cp .env.example .env')} and add your private key`)
    console.log(`  3. ${chalk.cyan('npm install')}`)
    console.log(`  4. ${chalk.cyan('node index.js')}`)
    console.log()
}
