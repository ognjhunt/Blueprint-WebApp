import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Button = ({ children, variant = '', size = '', to }) => (
  <Link to={to} className={`blueprint-button ${variant} ${size}`}>
    {children}
  </Link>
);

const Card = ({ children, className = '' }) => (
  <div className={`blueprint-card ${className}`}>{children}</div>
);

const CardContent = ({ children, className = '' }) => (
  <div className={`blueprint-card-content ${className}`}>{children}</div>
);

const Feature = ({ icon, title, description }) => (
  <div className="blueprint-feature">
    <div className="blueprint-feature-icon">{icon}</div>
    <h4 className="blueprint-feature-title">{title}</h4>
    <p className="blueprint-feature-description">{description}</p>
  </div>
);

const HowItWorksStep = ({ icon, title, description }) => (
  <div className="blueprint-how-step">
    <div className="blueprint-how-icon">{icon}</div>
    <h4 className="blueprint-how-title">{title}</h4>
    <p className="blueprint-how-description">{description}</p>
  </div>
);

const UseCase = ({ image, title, description }) => (
  <div className="blueprint-use-case">
    <div className="blueprint-use-case-image">{image}</div>
    <h4 className="blueprint-use-case-title">{title}</h4>
    <p className="blueprint-use-case-description">{description}</p>
  </div>
);

const Testimonial = ({ quote, author, position, company }) => (
  <div className="blueprint-testimonial">
    <p className="blueprint-testimonial-quote">"{quote}"</p>
    <p className="blueprint-testimonial-author">
      – {author}, {position}, {company}
    </p>
  </div>
);

const LandingPage = () => {
  return (
    <div className="blueprint-landing-page">
      {/* Header */}
      <header className="blueprint-header">
        <div className="blueprint-container blueprint-header-content">
          <h1 className="blueprint-logo">Blueprint</h1>
          <nav>
            <ul className="blueprint-nav-list">
              <li>
                <Link to="/features">Features</Link>
              </li>
              <li>
                <Link to="/use-cases">Use Cases</Link>
              </li>
              <li>
                <Link to="/pricing">Pricing</Link>
              </li>
              <li>
                <Link to="/about-us">About Us</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <Button variant="outline" to="/request-demo">
                  Request a Demo
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="blueprint-hero">
        <div className="blueprint-container">
          <h2 className="blueprint-hero-title">
            Transform Your Space with AI-Powered, Personalized Customer Experiences
          </h2>
          <p className="blueprint-hero-subtitle">
            Engage, Personalize, and Elevate Every Interaction in Your Physical Space with Blueprint
          </p>
          <div className="blueprint-hero-buttons">
            <Button size="lg" to="/request-demo">
              Request a Demo
            </Button>
            <Button variant="outline" size="lg" to="/how-it-works">
              Learn How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="blueprint-features">
        <div className="blueprint-container">
          <h3 className="blueprint-section-title">Key Features</h3>
          <div className="blueprint-features-grid">
            <Feature
              icon="👓"
              title="Smart Glasses Integration"
              description="Seamlessly connect with customers using smart glasses to deliver real-time, personalized content."
            />
            <Feature
              icon="⚡"
              title="Real-Time Personalization"
              description="Tailor interactions based on customer preferences and behavior to enhance engagement and satisfaction."
            />
            <Feature
              icon="🗺️"
              title="Spatial Mapping"
              description="Utilize advanced spatial mapping to create interactive hotspots for targeted customer engagement."
            />
            <Feature
              icon="📊"
              title="Analytics Dashboard"
              description="Gain valuable insights into customer behavior and preferences with our intuitive analytics dashboard."
            />
            <Feature
              icon="🖊️"
              title="Easy Content Management"
              description="Effortlessly update and manage your AR content through our intuitive platform."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="blueprint-how-it-works">
        <div className="blueprint-container">
          <h3 className="blueprint-section-title">How It Works</h3>
          <div className="blueprint-how-steps">
            <HowItWorksStep
              icon="📍"
              title="Map Your Space"
              description="Scan your physical environment using our advanced mapping technology to create a digital blueprint."
            />
            <HowItWorksStep
              icon="🎨"
              title="Create Personalized Content"
              description="Design and place personalized content and interaction points throughout your space."
            />
            <HowItWorksStep
              icon="🤝"
              title="Engage Customers"
              description="As customers enter, Blueprint recognizes them and activates tailored experiences based on their context."
            />
            <HowItWorksStep
              icon="📈"
              title="Analyze and Optimize"
              description="Collect and analyze data on customer interactions to continuously improve and personalize experiences."
            />
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="blueprint-use-cases">
        <div className="blueprint-container">
          <h3 className="blueprint-section-title">Use Cases</h3>
          <div className="blueprint-use-cases-grid">
            <UseCase
              image="🛍️"
              title="Retail"
              description="Guide customers to products they love, provide instant product information, and offer personalized discounts."
            />
            <UseCase
              image="🏛️"
              title="Museums"
              description="Bring exhibits to life with interactive storytelling tailored to each visitor's interests."
            />
            <UseCase
              image="🏨"
              title="Hotels"
              description="Offer virtual concierge services, room customization, and personalized local recommendations."
            />
            <UseCase
              image="🎤"
              title="Conferences"
              description="Facilitate networking by displaying relevant attendee information and suggesting potential connections."
            />
            <UseCase
              image="🍽️"
              title="Restaurants"
              description="Present menu items in 3D, highlight dishes based on dietary preferences, and offer virtual wine pairings."
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="blueprint-benefits">
        <div className="blueprint-container">
          <h3 className="blueprint-section-title">Benefits for Your Business</h3>
          <ul className="blueprint-benefits-list">
            <li className="blueprint-benefit-item">
              <span className="blueprint-benefit-icon">📈</span>
              <h4 className="blueprint-benefit-title">Increased Customer Engagement</h4>
              <p className="blueprint-benefit-description">
                Create memorable, interactive experiences that keep customers coming back.
              </p>
            </li>
            <li className="blueprint-benefit-item">
              <span className="blueprint-benefit-icon">💰</span>
              <h4 className="blueprint-benefit-title">Higher Conversion Rates</h4>
              <p className="blueprint-benefit-description">
                Guide customers to products or services they're most likely to purchase.
              </p>
            </li>
            <li className="blueprint-benefit-item">
              <span className="blueprint-benefit-icon">🧠</span>
              <h4 className="blueprint-benefit-title">Improved Customer Understanding</h4>
              <p className="blueprint-benefit-description">
                Gain deep insights into customer behavior and preferences.
              </p>
            </li>
            <li className="blueprint-benefit-item">
              <span className="blueprint-benefit-icon">⚙️</span>
              <h4 className="blueprint-benefit-title">Operational Efficiency</h4>
              <p className="blueprint-benefit-description">
                Automate personalized customer service, reducing staff workload.
              </p>
            </li>
            <li className="blueprint-benefit-item">
              <span className="blueprint-benefit-icon">🏆</span>
              <h4 className="blueprint-benefit-title">Competitive Edge</h4>
              <p className="blueprint-benefit-description">
                Stand out in your industry by offering cutting-edge, futuristic experiences.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="blueprint-testimonials">
        <div className="blueprint-container">
          <h3 className="blueprint-section-title">What Our Clients Say</h3>
          <div className="blueprint-testimonials-grid">
            <Testimonial
              quote="Blueprint transformed our in-store experience, driving a 30% increase in sales."
              author="Jane Smith"
              position="Retail Manager"
              company="XYZ Store"
            />
            <Testimonial
              quote="Our museum visitors are more engaged than ever thanks to Blueprint's interactive exhibits."
              author="John Doe"
              position="Curator"
              company="City Museum"
            />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="blueprint-cta-section">
        <div className="blueprint-container">
          <h3 className="blueprint-cta-title">Ready to Elevate Your Customer Experience?</h3>
          <div className="blueprint-cta-buttons">
            <Button size="lg" to="/schedule-demo">
              Schedule a Demo
            </Button>
            <Button variant="outline" size="lg" to="/contact-sales">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="blueprint-footer">
        <div className="blueprint-container">
          <div className="blueprint-footer-columns">
            <div className="blueprint-footer-column">
              <h4>Quick Links</h4>
              <ul>
                <li>
                  <Link to="/features">Features</Link>
                </li>
                <li>
                  <Link to="/use-cases">Use Cases</Link>
                </li>
                <li>
                  <Link to="/pricing">Pricing</Link>
                </li>
                <li>
                  <Link to="/about-us">About Us</Link>
                </li>
                <li>
                  <Link to="/contact">Contact</Link>
                </li>
              </ul>
            </div>
            <div className="blueprint-footer-column">
              <h4>Contact Us</h4>
              <p>Email: support@blueprint.com</p>
              <p>Phone: (123) 456-7890</p>
              <p>Address: 123 Blueprint Ave, Innovation City, Techland</p>
            </div>
            <div className="blueprint-footer-column">
              <h4>Follow Us</h4>
              <div className="blueprint-social-links">
                <a href="https://facebook.com">📘 Facebook</a>
                <a href="https://twitter.com">🐦 Twitter</a>
                <a href="https://linkedin.com">🔗 LinkedIn</a>
              </div>
            </div>
          </div>
          <div className="blueprint-footer-bottom">
            <p>&copy; 2024 Blueprint. All rights reserved.</p>
            <div className="blueprint-legal-links">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-of-service">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
