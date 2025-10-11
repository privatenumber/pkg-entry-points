import { testSuite, expect } from 'manten';
import { testScenarios } from '../utils.js';

export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints } of testScenarios) {
		describe(scenario, ({ describe }) => {
			describe('real packages', ({ test }) => {
				test('vue', async () => {
					const packagePath = './node_modules/vue';
					const packageExports = await getPackageEntryPoints(packagePath);

					expect(packageExports).toStrictEqual({
						'.': [
							[['import', 'types'], './dist/vue.d.mts'],
							[['import', 'node'], './index.mjs'],
							[['default', 'import'], './dist/vue.runtime.esm-bundler.js'],
							[['require', 'types'], './dist/vue.d.ts'],
							[['default', 'require'], './index.js'],
						],
						'./server-renderer': [
							[['import', 'types'], './server-renderer/index.d.mts'],
							[['default', 'import'], './server-renderer/index.mjs'],
							[['require', 'types'], './server-renderer/index.d.ts'],
							[['default', 'require'], './server-renderer/index.js'],
						],
						'./compiler-sfc': [
							[['import', 'types'], './compiler-sfc/index.d.mts'],
							[['default', 'import'], './compiler-sfc/index.mjs'],
							[['require', 'types'], './compiler-sfc/index.d.ts'],
							[['default', 'require'], './compiler-sfc/index.js'],
						],
						'./jsx-runtime': [
							[['types'], './jsx-runtime/index.d.ts'],
							[['import'], './jsx-runtime/index.mjs'],
							[['require'], './jsx-runtime/index.js'],
						],
						'./jsx-dev-runtime': [
							[['types'], './jsx-runtime/index.d.ts'],
							[['import'], './jsx-runtime/index.mjs'],
							[['require'], './jsx-runtime/index.js'],
						],
						'./jsx': [[['default'], './jsx.d.ts']],
						'./dist/vue.cjs.js': [[['default'], './dist/vue.cjs.js']],
						'./dist/vue.cjs.prod.js': [[['default'], './dist/vue.cjs.prod.js']],
						'./dist/vue.d.mts': [[['default'], './dist/vue.d.mts']],
						'./dist/vue.d.ts': [[['default'], './dist/vue.d.ts']],
						'./dist/vue.esm-browser.js': [[['default'], './dist/vue.esm-browser.js']],
						'./dist/vue.esm-browser.prod.js': [[['default'], './dist/vue.esm-browser.prod.js']],
						'./dist/vue.esm-bundler.js': [[['default'], './dist/vue.esm-bundler.js']],
						'./dist/vue.global.js': [[['default'], './dist/vue.global.js']],
						'./dist/vue.global.prod.js': [[['default'], './dist/vue.global.prod.js']],
						'./dist/vue.runtime.esm-browser.js': [[['default'], './dist/vue.runtime.esm-browser.js']],
						'./dist/vue.runtime.esm-browser.prod.js': [[['default'], './dist/vue.runtime.esm-browser.prod.js']],
						'./dist/vue.runtime.esm-bundler.js': [[['default'], './dist/vue.runtime.esm-bundler.js']],
						'./dist/vue.runtime.global.js': [[['default'], './dist/vue.runtime.global.js']],
						'./dist/vue.runtime.global.prod.js': [[['default'], './dist/vue.runtime.global.prod.js']],
						'./package.json': [[['default'], './package.json']],
						'./macros': [[['default'], './macros.d.ts']],
						'./macros-global': [[['default'], './macros-global.d.ts']],
						'./ref-macros': [[['default'], './ref-macros.d.ts']],
					});
				});

				test('axios', async () => {
					const packagePath = './node_modules/axios';
					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './index.js'],
							[['require', 'types'], './index.d.cts'],
							[['default', 'types'], './index.d.ts'],
							[['browser', 'require'], './dist/browser/axios.cjs'],
							[['browser', 'default'], './index.js'],
							[['default', 'require'], './dist/node/axios.cjs'],
						],
						'./lib/adapters/http.js': [[['default'], './lib/adapters/http.js']],
						'./lib/adapters/xhr.js': [[['default'], './lib/adapters/xhr.js']],
						'./unsafe/adapters/README.md': [[['default'], './lib/adapters/README.md']],
						'./unsafe/adapters/adapters.js': [[['default'], './lib/adapters/adapters.js']],
						'./unsafe/adapters/fetch.js': [[['default'], './lib/adapters/fetch.js']],
						'./unsafe/adapters/http.js': [[['default'], './lib/adapters/http.js']],
						'./unsafe/adapters/xhr.js': [[['default'], './lib/adapters/xhr.js']],
						'./unsafe/axios.js': [[['default'], './lib/axios.js']],
						'./unsafe/cancel/CancelToken.js': [[['default'], './lib/cancel/CancelToken.js']],
						'./unsafe/cancel/CanceledError.js': [[['default'], './lib/cancel/CanceledError.js']],
						'./unsafe/cancel/isCancel.js': [[['default'], './lib/cancel/isCancel.js']],
						'./unsafe/core/Axios.js': [[['default'], './lib/core/Axios.js']],
						'./unsafe/core/AxiosError.js': [[['default'], './lib/core/AxiosError.js']],
						'./unsafe/core/AxiosHeaders.js': [[['default'], './lib/core/AxiosHeaders.js']],
						'./unsafe/core/InterceptorManager.js': [[['default'], './lib/core/InterceptorManager.js']],
						'./unsafe/core/README.md': [[['default'], './lib/core/README.md']],
						'./unsafe/core/buildFullPath.js': [[['default'], './lib/core/buildFullPath.js']],
						'./unsafe/core/dispatchRequest.js': [[['default'], './lib/core/dispatchRequest.js']],
						'./unsafe/core/mergeConfig.js': [[['default'], './lib/core/mergeConfig.js']],
						'./unsafe/core/settle.js': [[['default'], './lib/core/settle.js']],
						'./unsafe/core/transformData.js': [[['default'], './lib/core/transformData.js']],
						'./unsafe/defaults/index.js': [[['default'], './lib/defaults/index.js']],
						'./unsafe/defaults/transitional.js': [[['default'], './lib/defaults/transitional.js']],
						'./unsafe/env/README.md': [[['default'], './lib/env/README.md']],
						'./unsafe/env/classes/FormData.js': [[['default'], './lib/env/classes/FormData.js']],
						'./unsafe/env/data.js': [[['default'], './lib/env/data.js']],
						'./unsafe/helpers/AxiosTransformStream.js': [[['default'], './lib/helpers/AxiosTransformStream.js']],
						'./unsafe/helpers/AxiosURLSearchParams.js': [[['default'], './lib/helpers/AxiosURLSearchParams.js']],
						'./unsafe/helpers/HttpStatusCode.js': [[['default'], './lib/helpers/HttpStatusCode.js']],
						'./unsafe/helpers/README.md': [[['default'], './lib/helpers/README.md']],
						'./unsafe/helpers/ZlibHeaderTransformStream.js': [[['default'], './lib/helpers/ZlibHeaderTransformStream.js']],
						'./unsafe/helpers/bind.js': [[['default'], './lib/helpers/bind.js']],
						'./unsafe/helpers/buildURL.js': [[['default'], './lib/helpers/buildURL.js']],
						'./unsafe/helpers/callbackify.js': [[['default'], './lib/helpers/callbackify.js']],
						'./unsafe/helpers/combineURLs.js': [[['default'], './lib/helpers/combineURLs.js']],
						'./unsafe/helpers/composeSignals.js': [[['default'], './lib/helpers/composeSignals.js']],
						'./unsafe/helpers/cookies.js': [[['default'], './lib/helpers/cookies.js']],
						'./unsafe/helpers/deprecatedMethod.js': [[['default'], './lib/helpers/deprecatedMethod.js']],
						'./unsafe/helpers/formDataToJSON.js': [[['default'], './lib/helpers/formDataToJSON.js']],
						'./unsafe/helpers/formDataToStream.js': [[['default'], './lib/helpers/formDataToStream.js']],
						'./unsafe/helpers/fromDataURI.js': [[['default'], './lib/helpers/fromDataURI.js']],
						'./unsafe/helpers/isAbsoluteURL.js': [[['default'], './lib/helpers/isAbsoluteURL.js']],
						'./unsafe/helpers/isAxiosError.js': [[['default'], './lib/helpers/isAxiosError.js']],
						'./unsafe/helpers/isURLSameOrigin.js': [[['default'], './lib/helpers/isURLSameOrigin.js']],
						'./unsafe/helpers/null.js': [[['default'], './lib/helpers/null.js']],
						'./unsafe/helpers/parseHeaders.js': [[['default'], './lib/helpers/parseHeaders.js']],
						'./unsafe/helpers/parseProtocol.js': [[['default'], './lib/helpers/parseProtocol.js']],
						'./unsafe/helpers/progressEventReducer.js': [[['default'], './lib/helpers/progressEventReducer.js']],
						'./unsafe/helpers/readBlob.js': [[['default'], './lib/helpers/readBlob.js']],
						'./unsafe/helpers/resolveConfig.js': [[['default'], './lib/helpers/resolveConfig.js']],
						'./unsafe/helpers/speedometer.js': [[['default'], './lib/helpers/speedometer.js']],
						'./unsafe/helpers/spread.js': [[['default'], './lib/helpers/spread.js']],
						'./unsafe/helpers/throttle.js': [[['default'], './lib/helpers/throttle.js']],
						'./unsafe/helpers/toFormData.js': [[['default'], './lib/helpers/toFormData.js']],
						'./unsafe/helpers/toURLEncodedForm.js': [[['default'], './lib/helpers/toURLEncodedForm.js']],
						'./unsafe/helpers/trackStream.js': [[['default'], './lib/helpers/trackStream.js']],
						'./unsafe/helpers/validator.js': [[['default'], './lib/helpers/validator.js']],
						'./unsafe/platform/browser/classes/Blob.js': [[['default'], './lib/platform/browser/classes/Blob.js']],
						'./unsafe/platform/browser/classes/FormData.js': [[['default'], './lib/platform/browser/classes/FormData.js']],
						'./unsafe/platform/browser/classes/URLSearchParams.js': [[['default'], './lib/platform/browser/classes/URLSearchParams.js']],
						'./unsafe/platform/browser/index.js': [[['default'], './lib/platform/browser/index.js']],
						'./unsafe/platform/common/utils.js': [[['default'], './lib/platform/common/utils.js']],
						'./unsafe/platform/index.js': [[['default'], './lib/platform/index.js']],
						'./unsafe/platform/node/classes/FormData.js': [[['default'], './lib/platform/node/classes/FormData.js']],
						'./unsafe/platform/node/classes/URLSearchParams.js': [[['default'], './lib/platform/node/classes/URLSearchParams.js']],
						'./unsafe/platform/node/index.js': [[['default'], './lib/platform/node/index.js']],
						'./unsafe/utils.js': [[['default'], './lib/utils.js']],
						'./package.json': [[['default'], './package.json']],
					});
				});
			});
		});
	}
});
