import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Mail, Phone, MapPin, MessageSquare, Globe,
  ArrowRight, CheckCircle, Clock, Menu, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthModal } from '../store/authModalStore';
import { useIsDesktop } from '../hooks/useIsDesktop';

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const openAuth = useAuthModal((s) => s.open);
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const isContact = location.pathname === '/contact';
  const isHome = location.pathname === '/';

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
              <img src="/phonicity2.png" alt="Phonicity" className="h-9 w-9 object-contain rounded-md" />
              <span className="text-xl font-bold text-primary tracking-tight">Phonicity</span>
            </Link>
            {isDesktop && (
              <>
                <nav className="flex items-center gap-8">
                  <Link to="/" className={`text-sm font-medium transition-colors ${isHome ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>Home</Link>
                  <a href="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
                  <a href="/#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                  <a href="/#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
                  <Link to="/contact" className={`text-sm font-medium transition-colors ${isContact ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>Contact</Link>
                </nav>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" className="font-semibold" onClick={() => openAuth('login')}>Sign in</Button>
                  <Button className="font-semibold shadow-lg shadow-primary/20" onClick={() => openAuth('signup')}>
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            {!isDesktop && (
              <button
                className="p-2 rounded-lg hover:bg-muted"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        {!isDesktop && mobileMenuOpen && (
          <div className="border-t border-border bg-background">
            <div className="px-4 py-4 space-y-3">
              <Link to="/" className={`block text-sm font-medium border-l-2 pl-3 py-1.5 transition-colors ${isHome ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <a href="/#features" className="block text-sm font-medium border-l-2 border-transparent pl-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="/#pricing" className="block text-sm font-medium border-l-2 border-transparent pl-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="/#faq" className="block text-sm font-medium border-l-2 border-transparent pl-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <Link to="/contact" className={`block text-sm font-medium border-l-2 pl-3 py-1.5 transition-colors ${isContact ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full font-semibold" onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}>Sign in</Button>
                <Button className="w-full font-semibold" onClick={() => { openAuth('signup'); setMobileMenuOpen(false); }}>Get Started Free</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Contact Section */}
      <section className={`bg-auth-mesh ${isDesktop ? 'py-28' : 'py-10'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`text-center max-w-2xl mx-auto ${isDesktop ? 'mb-16' : 'mb-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              <MessageSquare className="h-3.5 w-3.5" />
              Get in Touch
            </div>
            <h1 className={`${isDesktop ? 'text-5xl' : 'text-3xl'} font-bold text-foreground`}>
              Let's talk about your <span className="text-primary">communication needs</span>
            </h1>
            <p className={`mt-3 ${isDesktop ? 'text-lg' : 'text-sm'} text-muted-foreground`}>
              Have questions about Phonicity? Want to set up virtual numbers for your team? Reach out, and let's find the perfect communication solution for your business.
            </p>
          </div>

          <div className={`grid ${isDesktop ? 'grid-cols-1 lg:grid-cols-3 gap-8' : 'grid-cols-1 gap-3'}`}>
            {/* Contact Info Cards */}
            <div className={isDesktop ? 'space-y-4' : 'space-y-3'}>
              <div className={`glass-card rounded-2xl ${isDesktop ? 'p-6' : 'p-4'}`}>
                <div className={`${isDesktop ? 'h-12 w-12' : 'h-10 w-10'} rounded-xl bg-primary/10 flex items-center justify-center mb-3`}>
                  <Mail className={`${isDesktop ? 'h-6 w-6' : 'h-5 w-5'} text-primary`} />
                </div>
                <h3 className={`${isDesktop ? '' : 'text-sm'} font-semibold text-foreground`}>Email Us</h3>
                <p className={`mt-1 ${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>We'll respond within 24 hours.</p>
                <a href="mailto:support@phonicity.com" className={`mt-2 block ${isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-primary hover:underline`}>
                  support@phonicity.com
                </a>
              </div>

              <div className={`glass-card rounded-2xl ${isDesktop ? 'p-6' : 'p-4'}`}>
                <div className={`${isDesktop ? 'h-12 w-12' : 'h-10 w-10'} rounded-xl bg-primary/10 flex items-center justify-center mb-3`}>
                  <Phone className={`${isDesktop ? 'h-6 w-6' : 'h-5 w-5'} text-primary`} />
                </div>
                <h3 className={`${isDesktop ? '' : 'text-sm'} font-semibold text-foreground`}>Call Us</h3>
                <p className={`mt-1 ${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>Mon-Fri, 9am-6pm EST.</p>
                <a href="tel:+18005551234" className={`mt-2 block ${isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-primary hover:underline`}>
                  +1 (800) 555-1234
                </a>
              </div>

              <div className={`glass-card rounded-2xl ${isDesktop ? 'p-6' : 'p-4'}`}>
                <div className={`${isDesktop ? 'h-12 w-12' : 'h-10 w-10'} rounded-xl bg-primary/10 flex items-center justify-center mb-3`}>
                  <MapPin className={`${isDesktop ? 'h-6 w-6' : 'h-5 w-5'} text-primary`} />
                </div>
                <h3 className={`${isDesktop ? '' : 'text-sm'} font-semibold text-foreground`}>Visit Us</h3>
                <p className={`mt-1 ${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>Our headquarters.</p>
                <p className={`mt-2 ${isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-foreground`}>
                  123 Cloud Avenue<br />
                  San Francisco, CA 94107
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className={`glass-panel rounded-2xl ${isDesktop ? 'p-8' : 'p-4'}`}>
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
                    <h2 className={`${isDesktop ? 'text-2xl' : 'text-lg'} font-bold text-foreground mb-2`}>Send us a message</h2>
                    <p className={`text-muted-foreground ${isDesktop ? 'text-sm' : 'text-xs'} mb-4`}>Fill out the form below and we'll get back to you shortly.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className={`grid ${isDesktop ? 'grid-cols-1 md:grid-cols-2 gap-5' : 'grid-cols-1 gap-3'}`}>
                        <div className="space-y-1.5">
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
                        <div className="space-y-1.5">
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
                      <div className="space-y-1.5">
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
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground" htmlFor="message">
                          Message
                        </label>
                        <textarea
                          id="message"
                          rows={isDesktop ? 5 : 4}
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
          <div className={`grid ${isDesktop ? 'grid-cols-1 md:grid-cols-3 gap-6 mt-16' : 'grid-cols-1 gap-3 mt-8'}`}>
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
      <footer className={`border-t border-border ${isDesktop ? 'py-8' : 'py-6'}`}>
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
