import { resendClient, sender } from "../lib/resend.js";

const sendEmail = async (to, subject, html) => {
  if (!resendClient) {
    console.log("Resend client not configured, skipping email send");
    return;
  }
  return resendClient.emails.send({
    from: sender,
    to: [to],
    subject,
    html,
  });
};
import { createWelcomeEmailTemplate } from "../emails/emailTemplates.js";

export const sendWelcomeEmail = async (email, name, clientURL) => {
  const { data, error } = await resendClient.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: email,
    subject: "Welcome to Chatify!",
    html: createWelcomeEmailTemplate(name, clientURL),
  });

  if (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Failed to send welcome email");
  }

  console.log("Welcome Email sent successfully", data);
};
