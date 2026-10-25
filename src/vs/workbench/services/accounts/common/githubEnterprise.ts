/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

function isGitHubEnterpriseEndpoint(uri: URI): boolean {
	const url = new URL(uri.toString());
	const hostname = url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname;
	return ['http:', 'https:'].includes(url.protocol)
		&& !['github.com', 'www.github.com', 'api.github.com'].includes(hostname)
		&& !url.username && !url.password && !url.search && !url.hash
		&& !uri.path.includes('//') && !uri.path.split('/').some(part => part === '.' || part === '..');
}

/** Returns the enterprise base identified by a session's OAuth issuer, never by configuration. */
export function getGitHubEnterpriseUri(authorizationServer: URI | undefined): URI | undefined {
	if (!authorizationServer) {
		return undefined;
	}
	try {
		const path = authorizationServer.path;
		const suffix = '/login/oauth';
		if (!isGitHubEnterpriseEndpoint(authorizationServer) || !path.endsWith(suffix)) {
			return undefined;
		}
		return authorizationServer.with({
			scheme: authorizationServer.scheme.toLowerCase(),
			authority: authorizationServer.authority.toLowerCase(),
			path: path.slice(0, -suffix.length),
		});
	} catch {
		return undefined;
	}
}
