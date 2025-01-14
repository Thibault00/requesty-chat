import { environment } from '@raycast/api';

export const logger = {
	log: (...args: any[]) => {
		if (environment.isDevelopment) {
			console.log(new Date().toISOString(), ...args);
		}
	},
	error: (...args: any[]) => {
		if (environment.isDevelopment) {
			console.error(new Date().toISOString(), ...args);
		}
	},
};
