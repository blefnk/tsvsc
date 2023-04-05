/* eslint-disable @typescript-eslint/no-require-imports */
// will be required from ./node_modules/typescript-essential-plugins/index.js
const originalPluginFactory = require('typescript-essential-plugins')

const plugin = (context => {
    const { typescript } = context
    let configurationHost = context.configurationHost!
    configurationHost ??= context['env'].configurationHost
    const patchConfig = config => {
        return {
            ...config,
            _additionalPluginOptions: {
                pluginSpecificSyntaxServerConfigCheck: false,
            },
            enablePlugin: config.enableVueSupport,
        }
    }

    if (typescript && configurationHost) {
        const plugin = originalPluginFactory({
            typescript: typescript.module,
        })
        // todo support vue-specific settings
        const originalLsMethods = { ...typescript.languageService }

        void configurationHost.getConfiguration<any>('tsEssentialPlugins').then(_configuration => {
            // if (typescript.languageService[thisPluginMarker]) return
            const config = patchConfig(_configuration)
            if (!config.enablePlugin) return
            const proxy = plugin.create({
                ...typescript,
                config,
                languageService: originalLsMethods as any,
            } as any)
            console.log('TS Essentials Plugins activated!')
            // const methodToReassign = ['getCompletionsAtPosition', 'getCompletionEntryDetails']
            for (const method of Object.keys(proxy)) {
                typescript.languageService[method] = proxy[method]
            }
        })

        configurationHost.onDidChangeConfiguration(() => {
            void configurationHost.getConfiguration<any>('tsEssentialPlugins').then(config => {
                config = patchConfig(config)
                plugin.onConfigurationChanged?.(config)
                // temporary workaround
                if (!config.enablePlugin) {
                    typescript.languageService = originalLsMethods
                }
            })
        })
        // typescript.languageService[thisPluginMarker] = true
    } else {
        console.warn('Failed to activate tsEssentialPlugins, because of no typescript or configurationHost context')
    }
    return {}
}) satisfies import('@volar/language-service').LanguageServicePlugin

module.exports = {
    plugins: [
        c => {
            try {
                return plugin(c)
            } catch (err) {
                console.log('TS Essentials error', err)
                return {}
            }
        },
    ],
}
