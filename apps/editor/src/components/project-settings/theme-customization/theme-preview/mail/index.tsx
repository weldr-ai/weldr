import { Mail } from "./components/mail";
import { accounts, mails } from "./data";

export function MailDemo() {
  return <Mail accounts={accounts} mails={mails} navCollapsedSize={4} />;
}
