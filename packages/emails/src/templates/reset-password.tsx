import { tailwindConfig } from "../tailwind";

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  firstName: string;
  resetPasswordLink: string;
}

export function ResetPasswordEmail({
  firstName,
  resetPasswordLink,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Integramind password</Preview>
      <Tailwind config={tailwindConfig}>
        <Body>
          <Container className="mx-auto py-8 px-4">
            <Img
              src={
                process.env.NODE_ENV === "development"
                  ? "http://localhost:3000/logo.svg"
                  : "https://integramind.com/logo.svg"
              }
              width="32"
              height="32"
              alt="IntegraMind"
            />
            <Section>
              <Text>Hi {firstName},</Text>
              <Text>Click below to reset your IntegraMind password:</Text>
              <Container className="flex justify-center">
                <Button
                  href={resetPasswordLink}
                  className="inline-flex items-center justify-center bg-primary text-white rounded-md text-sm h-8 px-4 py-2"
                >
                  Reset password
                </Button>
              </Container>
              <Text className="font-bold text-red-600">
                ⚠️ If you didn't request a password reset, please ignore this
                email and ensure your account is secure.
              </Text>
              <Text>Thanks,</Text>
              <Text>IntegraMind</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default ResetPasswordEmail;
