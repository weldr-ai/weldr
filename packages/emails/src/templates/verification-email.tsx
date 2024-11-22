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

interface VerificationEmailProps {
  firstName: string;
  verificationLink: string;
}

export function VerificationEmail({
  firstName,
  verificationLink,
}: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Integramind! Please verify your email</Preview>
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
              <Text>
                Welcome to IntegraMind! We're thrilled to have you join our
                community of innovative thinkers and problem solvers.
              </Text>
              <Container className="flex justify-center">
                <Button
                  href={verificationLink}
                  className="inline-flex items-center justify-center bg-primary text-white rounded-md text-sm h-8 px-4 py-2"
                >
                  Verify your email
                </Button>
              </Container>
              <Text>
                If you have any questions or need assistance, our support team
                is here to help.
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

VerificationEmail.PreviewProps = {
  firstName: "Bob",
  verificationLink: "http://localhost:3001/auth/verify-email",
} as VerificationEmailProps;

export default VerificationEmail;
