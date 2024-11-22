import { db } from "@integramind/db";
import ResetPasswordEmail from "@integramind/emails/reset-password";
import VerificationEmail from "@integramind/emails/verification-email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { oAuthProxy } from "better-auth/plugins";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      console.log("Sending verification email to", user.email);
      await resend.emails.send({
        from: "IntegraMind <noreply@integramind.ai>",
        to: user.email,
        subject: "Verify your email address",
        react: (
          <VerificationEmail
            verificationLink={url}
            firstName={user.name.split(" ")[0] ?? user.email}
          />
        ),
      });
    },
    sendOnSignUp: true,
  },
  account: {
    accountLinking: {
      trustedProviders: ["google", "github", "microsoft"],
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    async sendResetPassword({ user, url, token }, request) {
      await resend.emails.send({
        from: "IntegraMind <noreply@integramind.ai>",
        to: user.email,
        subject: "Reset your password",
        react: (
          <ResetPasswordEmail
            firstName={user.name.split(" ")[0] ?? user.email}
            resetPasswordLink={url}
          />
        ),
      });
    },
  },
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID || "",
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  //   },
  //   google: {
  //     clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  //   },
  //   microsoft: {
  //     clientId: process.env.MICROSOFT_CLIENT_ID || "",
  //     clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
  //   },
  // },
  plugins: [oAuthProxy(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
