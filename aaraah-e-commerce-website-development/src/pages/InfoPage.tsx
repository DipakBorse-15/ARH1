import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { siteConfig } from "@/config/site";

type InfoKey = "about" | "contact" | "faq";

const WA_LINK = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent("Namaste AARAAH! Mujhe ek sawal poochna hai.")}`;

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I place an order?",
    a: "Add the products you like to your cart, open the cart and tap Checkout, sign in or create an account, enter your address and place the order. You then pay by UPI using the QR code on the order page.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "Right now we accept UPI (GPay, PhonePe, Paytm and any other UPI app). Cash on Delivery is coming soon.",
  },
  {
    q: "I have paid. How will I know my order is confirmed?",
    a: "After paying, enter the UTR / transaction number from your UPI app on the order page. We check the payment and confirm your order, and you will see the status change under Account → My Orders. We also email you.",
  },
  {
    q: "What happens if I do not pay?",
    a: "An order is held for 3 hours. If no payment is received in that time, it is cancelled automatically so the stock can go to other customers. You can place the order again any time.",
  },
  {
    q: "Is there a shipping charge?",
    a: "No. Shipping is free on all orders within India.",
  },
  {
    q: "How long will delivery take?",
    a: "We usually dispatch within 1–3 working days after your payment is confirmed. Delivery then takes about 5–7 working days, depending on your location.",
  },
  {
    q: "How can I track my order?",
    a: "Open Account → My Orders to see the status of every order. When your order ships, we share the courier details by email or WhatsApp.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, until it is shipped. Open the order under Account → My Orders and tap Cancel. If you had already paid, we will contact you about the refund.",
  },
  {
    q: "What is your return policy?",
    a: "You can request a return within 7 days of delivery if the item is damaged, defective or not what you ordered. Please contact us within 48 hours of delivery with photos. Details are on the Returns & Refunds page.",
  },
  {
    q: "Do I need an account to shop?",
    a: "You can browse and fill your cart without an account. You need an account only to place the order, so we can show you your order status.",
  },
  {
    q: "I forgot my password.",
    a: "On the sign-in page tap Forgot password?, enter your email and we will send you a link to set a new one.",
  },
  {
    q: "What is the Direct Purchase button?",
    a: "On a product page, Direct Purchase opens WhatsApp with a ready message about that product, so you can order by chatting with us without creating an account.",
  },
];

export default function InfoPage({ doc }: { doc: InfoKey }) {
  if (doc === "about") {
    return (
      <Shell title="About Us" path="/about" intro={`${siteConfig.name} is an Indian ethnic wear label from Surat.`}>
        <Section heading="Who we are">
          <p>
            {siteConfig.name} is run by {siteConfig.sellerName}, based in Surat. We bring Indian ethnic wear to your door
            across India, with simple ordering and a team you can talk to directly.
          </p>
        </Section>
        <Section heading="What you will find">
          <p>
            Sarees, kurties and kurta sets, lehengas, dupattas and stoles, bottomwear and blouses, arranged into collections
            for festive, daily and occasion wear, with new designs added regularly.
          </p>
        </Section>
        <Section heading="How we work">
          <ul className="list-disc space-y-1 pl-5">
            <li>Free shipping on every order within India.</li>
            <li>Simple UPI payment; we confirm your order once we see the payment.</li>
            <li>Orders are dispatched in 1–3 working days after confirmation.</li>
            <li>7-day returns for damaged, defective or wrong items.</li>
            <li>
              Questions? Talk to us on{" "}
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-rose-900 underline">
                WhatsApp
              </a>{" "}
              or see our <Link to="/contact" className="text-rose-900 underline">Contact</Link> page.
            </li>
          </ul>
        </Section>
      </Shell>
    );
  }

  if (doc === "contact") {
    return (
      <Shell title="Contact Us" path="/contact" intro="We are happy to help with orders, products or anything else.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="WhatsApp (fastest)">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-rose-900 underline">
              Chat on WhatsApp
            </a>
            <p className="mt-1 text-xs text-stone-500">{siteConfig.supportPhone}</p>
          </Card>
          <Card title="Phone">
            <a href={`tel:${siteConfig.supportPhone.replace(/\s/g, "")}`} className="text-rose-900 underline">
              {siteConfig.supportPhone}
            </a>
          </Card>
          <Card title="Email">
            <a href={`mailto:${siteConfig.supportEmail}`} className="text-rose-900 underline">
              {siteConfig.supportEmail}
            </a>
          </Card>
          <Card title="Address">
            <p>{siteConfig.sellerAddress}</p>
          </Card>
        </div>
        <Section heading="For order help">
          <p>Please mention your order number (it starts with AR) so we can help you faster. You can see it under Account → My Orders.</p>
        </Section>
        <Section heading="Grievance Officer">
          <p>
            {siteConfig.grievanceOfficer}
            <br />
            Email: {siteConfig.supportEmail} · Phone: {siteConfig.supportPhone}
          </p>
          <p>For any complaint, write to the Grievance Officer. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>
        </Section>
        <p className="text-sm text-stone-600">
          Many answers are also in our <Link to="/faq" className="text-rose-900 underline">FAQs</Link>.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="Frequently Asked Questions" path="/faq" intro="Quick answers about ordering, payment, delivery and returns.">
      <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200">
        {FAQS.map((f) => (
          <details key={f.q} className="group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-stone-900">
              {f.q}
              <span aria-hidden="true" className="text-stone-400 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="text-sm text-stone-600">
        Still need help? <Link to="/contact" className="text-rose-900 underline">Contact us</Link>.
      </p>
      <script
        type="application/ld+json"
        // Lets Google show these answers directly in search results.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </Shell>
  );
}

function Shell({ title, path, intro, children }: { title: string; path: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SEO title={title} description={intro} canonicalPath={path} />
      <h1 className="font-serif text-3xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">{intro}</p>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-stone-900">{heading}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-700">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</p>
      {children}
    </div>
  );
}
