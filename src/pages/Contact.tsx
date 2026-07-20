import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Phone, MapPin, MessageSquare, Globe,
  ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthModal } from '../store/authModalStore';

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const openAuth = useAuthModal((s) => s.open);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 premium-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/phonicity2.png" alt="Phonicity" className="h-10 w-10 object-contain rounded-md" />
              <span className="text-xl font-bold text-primary tracking-tight">Phonicity</span>
            </Link>
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" className="font-semibold" onClick={() => openAuth('login')}>Sign in</Button>
              <Button className="font-semibold shadow-lg shadow-primary/20" onClick={() => openAuth('signup')}>
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Contact Section */}
      <section className="bg-auth-mesh py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              <MessageSquare className="h-3.5 w-3.5" />
              Get in Touch
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Let's talk about your <span className="text-primary">communication needs</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Have questions about Phonicity? Want to set up virtual numbers for your team? Reach out, and let's find the perfect communication solution for your business.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Info Cards */}
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Email Us</h3>
                <p className="mt-1 text-sm text-muted-foreground">We'll respond within 24 hours.</p>
                <a href="mailto:support@phonicity.com" className="mt-2 block text-sm font-semibold text-primary hover:underline">
                  support@phonicity.com
                </a>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Call Us</h3>
                <p className="mt-1 text-sm text-muted-foreground">Mon-Fri, 9am-6pm EST.</p>
                <a href="tel:+18005551234" className="mt-2 block text-sm font-semibold text-primary hover:underline">
                  +1 (800) 555-1234
                </a>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Visit Us</h3>
                <p className="mt-1 text-sm text-muted-foreground">Our headquarters.</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  123 Cloud Avenue<br />
                  San Francisco, CA 94107
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="glass-panel rounded-2xl p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">Message sent!</h3>
                    <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                      Thanks for reaching out. Our team will get back to you within 24 hours.
                    </p>
                    <Button
                      className="mt-6 font-semibold"
                      onClick={() => {
                        setSubmitted(false);
                        setForm({ name: '', email: '', company: '', message: '' });
                      }}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Send us a message</h2>
                    <p className="text-muted-foreground text-sm mb-6">Fill out the form below and we'll get back to you shortly.</p>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground" htmlFor="name">
                            Full Name
                          </label>
                          <Input
                            id="name"
                            type="text"
                            placeholder="John Doe"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="h-11 rounded-xl"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground" htmlFor="email">
                            Email Address
                          </label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="john@company.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="h-11 rounded-xl"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground" htmlFor="company">
                          Company (optional)
                        </label>
                        <Input
                          id="company"
                          type="text"
                          placeholder="Your company name"
                          value={form.company}
                          onChange={(e) => setForm({ ...form, company: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground" htmlFor="message">
                          Message
                        </label>
                        <textarea
                          id="message"
                          rows={5}
                          placeholder="Tell us about your communication needs..."
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full font-semibold text-base shadow-lg shadow-primary/20"
                      >
                        Send Message
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Quick Response</p>
                <p className="text-xs text-muted-foreground">Average reply time: under 2 hours</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Globe className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Global Support</p>
                <p className="text-xs text-muted-foreground">We support customers in 50+ countries</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <CheckCircle className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">No Commitment</p>
                <p className="text-xs text-muted-foreground">Free consultation, no strings attached</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/phonicity2.png" alt="Phonicity" className="h-8 w-8 object-contain rounded-md" />
            <span className="text-lg font-bold text-primary">Phonicity</span>
          </Link>
          <p className="text-sm text-muted-foreground">© 2024 Phonicity. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Contact;
