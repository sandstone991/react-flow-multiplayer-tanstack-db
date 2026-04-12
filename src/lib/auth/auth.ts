import "@tanstack/react-start/server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { env } from "@/env/server";
import { db } from "@/lib/drizzle";
import * as schema from "@/lib/drizzle/schema";

const socialProviders = {
	...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
		? {
				github: {
					clientId: env.GITHUB_CLIENT_ID,
					clientSecret: env.GITHUB_CLIENT_SECRET,
				},
			}
		: {}),
	...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? {
				google: {
					clientId: env.GOOGLE_CLIENT_ID,
					clientSecret: env.GOOGLE_CLIENT_SECRET,
				},
			}
		: {}),
};

export const auth = betterAuth({
	baseURL: env.VITE_BASE_URL,
	telemetry: {
		enabled: false,
	},
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),

	// https://www.better-auth.com/docs/integrations/tanstack#usage-tips
	plugins: [tanstackStartCookies()],

	// https://www.better-auth.com/docs/concepts/session-management#session-caching
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},

	// https://www.better-auth.com/docs/concepts/oauth
	socialProviders,

	// https://www.better-auth.com/docs/authentication/email-password
	emailAndPassword: {
		enabled: true,
	},

	experimental: {
		// https://www.better-auth.com/docs/adapters/drizzle#joins-experimental
		joins: true,
	},
});
