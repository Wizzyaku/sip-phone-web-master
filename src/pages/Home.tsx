import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud, Phone, MessageSquare, Route, Zap,
  CheckCircle, ArrowRight, Star, Menu, X, ChevronDown,
  Users, TrendingUp, Clock, BarChart3
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthModal } from '../store/authModalStore';

const features = [
  {
    icon: Phone,
    heading: 'Instant Virtual Numbers',
    content: 'Provision local, toll-free, or international phone numbers in minutes. Choose from 50+ countries and start receiving calls and SMS right away — no hardware required.',
  },
  {
    icon: Zap,
    heading: 'Crystal-Clear VoIP Calls',
    content: "Experience HD-quality voice calls over the cloud. Phonicity's reliable VoIP infrastructure ensures crystal-clear audio with minimal latency, whether you're calling across town or across the globe.",
  },
  {
    icon: MessageSquare,
    heading: 'SMS & MMS Messaging',
    content: 'Send and receive text and multimedia messages from your dashboard. Keep conversations organized with threaded messaging, automated replies, and delivery receipts for every message.',
  },
  {
    icon: Route,
    heading: 'Smart Call Routing',
    content: 'Route calls intelligently with custom forwarding rules, voicemail, and simultaneous ring. Ensure every call reaches the right person, every time — with full control from your dashboard.',
  },
];

const featureTabs = [
  {
    heading: 'Virtual Numbers',
    icon: Phone,
    content: "Provision local, toll-free, or international numbers in minutes. Phonicity's virtual numbers work instantly — no SIM cards, no hardware, no waiting. Just pick your number and start communicating.",
  },
  {
    heading: 'Intuitive Dashboard',
    icon: BarChart3,
    content: "Manage everything from one place. Phonicity's intuitive dashboard lets you view call history, manage numbers, track messages, and monitor usage — all with a clean, user-friendly interface designed for efficiency.",
  },
  {
    heading: 'Smart Call Routing',
    icon: Route,
    content: "Never miss an important call. Phonicity's smart routing forwards calls to the right team member, sends callers to voicemail when busy, and rings multiple devices simultaneously — all configurable in seconds.",
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    description: 'Perfect for solo professionals',
    price: '7',
    features: [
      '1 virtual phone number',
      'Unlimited inbound calls',
      'SMS & MMS messaging',
      'Standard support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Business',
    description: 'Best for growing teams',
    price: '25',
    features: [
      '3 virtual phone numbers',
      'Unlimited calls (in & out)',
      'Call forwarding & voicemail',
      'Priority support',
      'Team dashboard & analytics',
    ],
    cta: 'Get Business Plan',
    highlighted: true,
  },
];

const faqs = [
  {
    question: 'What is a virtual phone number and how does it work?',
    answer: 'A virtual phone number is a cloud-based phone number that isn\'t tied to a specific phone line or SIM card. With Phonicity, you can purchase a virtual number instantly and start making and receiving calls and SMS messages through our web dashboard or mobile app — no hardware required.',
  },
  {
    question: 'Can I port my existing phone number to Phonicity?',
    answer: 'Yes! You can port your existing phone number to Phonicity at any time. Our team handles the entire porting process for you, typically completing it within 3-5 business days. Contact our support team to get started with number porting.',
  },
  {
    question: 'What countries are supported for virtual numbers?',
    answer: 'Phonicity offers virtual phone numbers in over 50 countries, including the US, UK, Canada, Australia, and many European nations. You can purchase local, toll-free, or national numbers depending on availability in your desired country.',
  },
  {
    question: 'Can I send and receive SMS and MMS messages?',
    answer: 'Absolutely. Every Phonicity virtual number supports SMS messaging, and most numbers also support MMS for sending and receiving multimedia content. You can manage all your text conversations directly from the Phonicity dashboard with threaded views and delivery receipts.',
  },
  {
    question: 'Does Phonicity offer solutions for large teams and enterprises?',
    answer: 'Yes, our Enterprise Solutions are designed for larger organizations requiring custom configurations. We offer volume discounts, dedicated infrastructure, SSO integration, advanced analytics, and a dedicated account manager. Contact our sales team for a customized quote tailored to your needs.',
  },
];

const stats = [
  { count: '70k+', description: 'users connected — from freelancers to enterprise teams', icon: Users },
  { count: '35%', description: 'reduction in communication costs with Phonicity', icon: TrendingUp },
  { count: '15.3%', description: 'increase in team productivity reported by long-term clients', icon: BarChart3 },
  { count: '2x', description: 'faster call setup compared to traditional phone systems', icon: Clock },
];

export function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const openAuth = useAuthModal((s) => s.open);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 premium-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary tracking-tight">Phonicity</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
              <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" className="font-semibold" onClick={() => openAuth('login')}>Sign in</Button>
              <Button className="font-semibold shadow-lg shadow-primary/20" onClick={() => openAuth('signup')}>
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="block text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="block text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <Link to="/contact" className="block text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full font-semibold" onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}>Sign in</Button>
                <Button className="w-full font-semibold" onClick={() => { openAuth('signup'); setMobileMenuOpen(false); }}>Get Started Free</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-auth-mesh">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest">
                <CheckCircle className="h-3.5 w-3.5" />
                Cloud Telephony Platform
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Connect Your Team with{' '}
                <span className="text-primary">Phonicity</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Virtual phone numbers, VoIP calling, and SMS messaging — all from one intuitive dashboard. No hardware, no contracts, just instant communication.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button size="lg" className="font-semibold text-base shadow-lg shadow-primary/20" onClick={() => openAuth('signup')}>
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <a href="#pricing">
                  <Button size="lg" variant="outline" className="font-semibold text-base">
                    View Pricing
                  </Button>
                </a>
              </div>
              {/* Reviews */}
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-3">
                  {[
                    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=80&h=80&fit=facearea&facepad=2&q=80',
                    'https://images.unsplash.com/photo-1531927557220-a9e23c1e4794?w=80&h=80&fit=facearea&facepad=2&q=80',
                    'https://images.unsplash.com/photo-1541101767792-f9b2b1c4f127?w=80&h=80&fit=facearea&facepad=3&q=80',
                    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&h=80&fit=facearea&facepad=2&q=80',
                  ].map((src, i) => (
                    <img key={i} src={src} alt="" className="h-10 w-10 rounded-full border-2 border-background object-cover" />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(4)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <Star className="h-4 w-4 fill-yellow-400/50 text-yellow-400/50" />
                    <span className="ml-1 font-bold text-sm">4.8</span>
                    <span className="text-sm text-muted-foreground">/ 5</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">From Over <span className="font-bold">12.8k</span> Reviews</p>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative animate-fade-in animate-delay-200">
              <div className="glass-panel rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">phonicity.com/dashboard</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">+1 (555) 123-4567</p>
                        <p className="text-xs text-muted-foreground">Incoming call · 2:34</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-green-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">SMS Campaign</p>
                        <p className="text-xs text-muted-foreground">1,284 messages sent</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">Delivered</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">247</p>
                      <p className="text-xs text-muted-foreground">Calls today</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">89%</p>
                      <p className="text-xs text-muted-foreground">Answer rate</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">3</p>
                      <p className="text-xs text-muted-foreground">Active numbers</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="border-y border-border/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-6">
            Trusted by Modern Teams
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Experience the reliability chosen by startups, agencies, and enterprises worldwide.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Built for Modern Communication
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              At Phonicity, we solve the communication challenges faced by modern teams. From instant number provisioning to crystal-clear VoIP calls, we're dedicated to helping you stay connected and productive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div key={feature.heading} className="glass-card rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.heading}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Tabs Section */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Customize <span className="text-primary">Phonicity</span>'s features to perfectly suit your team's communication needs.
            </h2>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {featureTabs.map((tab, i) => (
              <button
                key={tab.heading}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === i
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.heading}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-w-3xl mx-auto">
            <div className="glass-card rounded-2xl p-8 md:p-12">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = featureTabs[activeTab].icon;
                    return <Icon className="h-7 w-7 text-primary" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{featureTabs[activeTab].heading}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{featureTabs[activeTab].content}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Fast-Track Your Communications
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              At Phonicity, we ensure a swift start with instant account setup. Experience the speed of modern cloud telephony redefined.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.count} className="text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.count}</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-[200px] mx-auto">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your team. Scale up anytime as you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-card border-2 border-primary shadow-xl shadow-primary/10'
                    : 'bg-card border border-border'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest">
                    Best value
                  </span>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-lg text-muted-foreground">.00</span>
                  <span className="text-sm text-muted-foreground ml-2">USD / monthly</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="block mt-8">
                  <Button
                    className="w-full font-semibold"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => openAuth('signup')}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-muted-foreground">
            Need custom enterprise solutions?{' '}
            <Link to="/contact" className="text-primary font-semibold hover:underline">
              Contact Sales
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ask us anything about Phonicity and our phone services, and get factual responses.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-foreground">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Let's Connect Together
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Phonicity is a cloud phone platform built for modern teams — designed to keep your team connected anywhere. Get started today with a free account.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="font-semibold text-base" onClick={() => openAuth('signup')}>
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="font-semibold text-base border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold text-primary">Phonicity</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Cloud telephony platform for modern teams. Virtual numbers, VoIP calling, and SMS messaging.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><a href="#faq" className="hover:text-primary">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
                <li><a href="#" className="hover:text-primary">About</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Get Started</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => openAuth('login')} className="hover:text-primary text-left">Sign in</button></li>
                <li><button onClick={() => openAuth('signup')} className="hover:text-primary text-left">Create account</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2024 Phonicity. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
