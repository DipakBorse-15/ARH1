import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { siteConfig } from "@/config/site";

type DocKey = "privacy" | "terms" | "returns" | "shipping";
type Section = { heading: string; body: string[] };
type Doc = { title: string; path: string; intro: string; sections: Section[] };

const UPDATED = "22 November 2026";
const EMAIL = siteConfig.supportEmail;
const PHONE = siteConfig.supportPhone;

const DOCS: Record<DocKey, Doc> = {
  shipping: {
    title: "Shipping Policy",
    path: "/shipping-policy",
    intro: `This policy explains how ${siteConfig.name} ships orders within India.`,
    sections: [
      {
        heading: "Shipping charges",
        body: ["We currently offer free shipping on all orders within India. We may change this in the future; the shipping charge shown at checkout is the charge you pay."],
      },
      {
        heading: "Order processing and delivery time",
        body: [
          "Orders are processed after payment is received and confirmed by us. We usually dispatch within 1–3 business days of confirmation.",
          "Delivery usually takes 5–7 business days after dispatch, depending on your location. Remote locations may take longer. Delivery times are estimates and not guaranteed.",
        ],
      },
      {
        heading: "Tracking",
        body: ["When your order is shipped, we will share the courier details with you by email or WhatsApp. You can also see your order status under Account → My Orders."],
      },
      {
        heading: "Delivery address",
        body: ["Please enter your full address, pincode and a working mobile number at checkout. We are not responsible for delays or failed delivery caused by incorrect or incomplete details."],
      },
      {
        heading: "Contact",
        body: [`For shipping questions write to ${EMAIL} or call ${PHONE}.`],
      },
    ],
  },
  returns: {
    title: "Cancellation & Refund Policy",
    path: "/returns-and-refunds",
    intro: `We want you to love what you order from ${siteConfig.name}. This policy explains how to cancel an order, when you can return an item, and how and when refunds are paid.`,
    sections: [
      {
        heading: "When you can return",
        body: [
          "You can request a return within 7 days of delivery if you received a damaged, defective or wrong item.",
          "Please contact us within 48 hours of delivery with photos of the product and the packaging.",
        ],
      },
      {
        heading: "Condition of the item",
        body: ["Items must be unused, unwashed and unaltered, with tags and original packaging intact. We cannot accept returns of items that show signs of use, damage caused after delivery, or perfume/stain marks."],
      },
      {
        heading: "Slight colour variation",
        body: ["Product photos are taken with care, but colours may look slightly different on different screens. Minor colour differences are not treated as a defect."],
      },
      {
        heading: "How to request a return",
        body: [`Email ${EMAIL} or call ${PHONE} with your order number, the reason and photos. We will confirm the next steps within 2 business days.`],
      },
      {
        heading: "Refunds",
        body: [
          "Once the returned item is received and checked, the refund is processed to the original payment method (UPI / bank account / card) within 5–7 business days. Your bank may take a few more days to show it.",
          "Shipping charges, if any were paid, are non-refundable except when the return is due to our error.",
          "If a return is not approved (for example the item shows signs of use), we will tell you the reason by email or WhatsApp.",
        ],
      },
      {
        heading: "Order cancellation by you",
        body: [
          "You can cancel an order before it is shipped from Account → My Orders, or by contacting us. Once an order is shipped it cannot be cancelled; you may use the return process above after delivery.",
          "If you have already paid for a cancelled order, the full amount is refunded to the original payment method within 5–7 business days.",
        ],
      },
      {
        heading: "Order cancellation by us",
        body: ["We may cancel an order if the item is out of stock, the price was shown wrongly, or payment could not be verified. In that case any amount you paid is refunded in full within 5–7 business days. An unpaid order may be cancelled automatically if payment is not completed in time."],
      },
      {
        heading: "Payment failed or money deducted twice",
        body: [`If money was deducted but no order was created, or you were charged twice, write to ${EMAIL} with your order number or payment reference (UTR / transaction ID). We will check and refund the extra amount within 5–7 business days.`],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    path: "/privacy-policy",
    intro: `${siteConfig.name} ("we", "us") respects your privacy. This policy explains what information we collect and how we use it when you use ${siteConfig.url.replace("https://", "")}.`,
    sections: [
      {
        heading: "Information we collect",
        body: [
          "Account details: your name, email address, mobile number and password (stored securely, never in plain text).",
          "Order details: delivery address, items ordered, order amount and payment status.",
          "Messages you send us on email or WhatsApp.",
        ],
      },
      {
        heading: "How we use it",
        body: ["To create your account, process and deliver your orders, send order updates, provide customer support, and improve our website. We do not sell your personal information."],
      },
      {
        heading: "Payments",
        body: [
          "Payments are made by UPI directly to our account and/or through our payment gateway partner (such as Razorpay), which may offer UPI, cards, net banking and wallets.",
          "Card, UPI PIN and bank login details are entered only on the payment partner's secure page. We do not see or store them. We keep only your order amount, payment status and payment reference (such as UTR or transaction ID).",
        ],
      },
      {
        heading: "Sharing",
        body: ["We share only what is needed with service providers who help us run the store, such as delivery partners (name, address, mobile number), our email provider and our hosting/database provider. We may also share information if required by law."],
      },
      {
        heading: "Cookies, local storage and analytics",
        body: [
          "We use your browser's storage to keep you signed in and remember your cart. You can clear it from your browser settings at any time.",
          "We use Google Analytics and Meta (Facebook) Pixel to understand how visitors use the site and to measure our advertising. These tools may set cookies and receive information such as pages viewed and device type. You can block cookies in your browser or use the opt-out tools of Google and Meta.",
        ],
      },
      {
        heading: "How long we keep data and security",
        body: [
          "We keep order records as long as needed for accounting, tax and legal requirements, and account details until you ask us to delete them.",
          "We use secure (HTTPS) connections and access controls to protect your data. No system is 100% secure, but we take reasonable steps to protect it.",
        ],
      },
      {
        heading: "Children",
        body: ["Our store is meant for adults. We do not knowingly collect information from children under 18."],
      },
      {
        heading: "Your choices",
        body: [`You can view and update your name, mobile number and addresses in your account. To ask for your data to be corrected or deleted, contact us at ${EMAIL}.`],
      },
      {
        heading: "Contact and grievances",
        body: [`Questions or complaints about this policy or your data: ${EMAIL} or ${PHONE} (${siteConfig.sellerAddress}). We reply within 2 business days. We may update this policy from time to time; the date above shows the latest version.`],
      },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    path: "/terms-and-conditions",
    intro: `By using this website and placing an order with ${siteConfig.name}, you agree to the terms below.`,
    sections: [
      {
        heading: "Products and prices",
        body: [
          "We try to show accurate descriptions, photos and prices. Colours may vary slightly by screen. Prices are in Indian Rupees (INR) and include applicable taxes unless stated otherwise.",
          "We may correct errors in price or availability and cancel an order if an item is out of stock or wrongly priced; in that case any amount paid will be refunded.",
        ],
      },
      {
        heading: "Orders and payment",
        body: [
          "An order is confirmed only after we receive and verify your payment. Payment is accepted by UPI and, where shown at checkout, through our payment gateway partner (such as Razorpay). Cash on Delivery is not available at this time.",
          "Payments are processed by the payment partner under its own terms. If a payment fails, any amount debited is returned by your bank or by us as described in our Cancellation & Refund Policy.",
          "You may also contact us on WhatsApp to place an order; such orders follow the same policies.",
        ],
      },
      {
        heading: "Your account",
        body: ["Please keep your login details safe. You are responsible for activity under your account. Provide correct and complete information."],
      },
      {
        heading: "Shipping, returns and refunds",
        body: ["Shipping, cancellations, returns and refunds are governed by our Shipping Policy and Cancellation & Refund Policy."],
      },
      {
        heading: "Intellectual property",
        body: [`All photos, text, logos and designs on this website belong to ${siteConfig.name}. You may not copy or use them without our written permission.`],
      },
      {
        heading: "Limitation of liability",
        body: ["To the extent permitted by law, we are not liable for indirect losses arising from the use of this website. Our liability for any order is limited to the amount paid for that order."],
      },
      {
        heading: "Governing law",
        body: ["These terms are governed by the laws of India. Courts at Surat, Gujarat have jurisdiction over any dispute."],
      },
      {
        heading: "Contact",
        body: [`${EMAIL} · ${PHONE}`],
      },
    ],
  },
};

const LINKS: { key: DocKey; label: string }[] = [
  { key: "shipping", label: "Shipping Policy" },
  { key: "returns", label: "Cancellation & Refund Policy" },
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms & Conditions" },
];

export default function LegalPage({ doc }: { doc: DocKey }) {
  const d = DOCS[doc];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SEO title={d.title} description={d.intro} canonicalPath={d.path} />
      <h1 className="font-serif text-3xl font-semibold text-stone-900">{d.title}</h1>
      <p className="mt-1 text-xs text-stone-400">Last updated: {UPDATED}</p>
      <p className="mt-5 text-sm leading-relaxed text-stone-600">{d.intro}</p>

      <div className="mt-6 space-y-6">
        {d.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-base font-semibold text-stone-900">{s.heading}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600">
              {s.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-200 pt-5 text-sm" aria-label="Other policies">
        {LINKS.filter((l) => l.key !== doc).map((l) => (
          <Link key={l.key} to={DOCS[l.key].path} className="text-rose-900 hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
