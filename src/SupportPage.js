import React, { useState } from 'react';

const Card = ({ children, className }) => (
  <div className={`supportpage-card ${className}`}>{children}</div>
);

const CardContent = ({ children, className }) => (
  <div className={`supportpage-card-content ${className}`}>{children}</div>
);

const Input = ({ ...props }) => (
  <input className="supportpage-input" {...props} />
);

const Button = ({ children, className, ...props }) => (
  <button className={`supportpage-button ${className}`} {...props}>{children}</button>
);

const Tabs = ({ children, defaultValue }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <div className="supportpage-tabs">
      {React.Children.map(children, child => 
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
};

const TabsList = ({ children }) => (
  <div className="supportpage-tabs-list">{children}</div>
);

const TabsTrigger = ({ children, value, activeTab, setActiveTab }) => (
  <button 
    className={`supportpage-tabs-trigger ${activeTab === value ? 'active' : ''}`}
    onClick={() => setActiveTab(value)}
  >
    {children}
  </button>
);

const TabsContent = ({ children, value, activeTab }) => (
  activeTab === value ? <div className="supportpage-tabs-content">{children}</div> : null
);

const SupportPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const commonIssues = [
    "How to create my first Blueprint",
    "Connecting smart devices",
    "Troubleshooting AR display issues",
    "Managing user permissions",
    "Updating my Blueprint"
  ];

  const supportCategories = [
    { icon: "🏠", name: "Getting Started" },
    { icon: "🛠️", name: "Technical Support" },
    { icon: "💡", name: "Feature Requests" },
    { icon: "💼", name: "Business Inquiries" },
    { icon: "🔒", name: "Account & Billing" },
    { icon: "📚", name: "Documentation" }
  ];

  return (
    <div className="supportpage-container">
      <div className="supportpage-content">
        <h1 className="supportpage-title">Blueprint Support</h1>
        <p className="supportpage-subtitle">
          We're here to help you optimize your Blueprint experience
        </p>

        <div className="supportpage-search">
          <Input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="supportpage-search-icon">
            <svg className="supportpage-icon" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        <div className="supportpage-categories">
          {supportCategories.map((category, index) => (
            <Card key={index} className="supportpage-category-card">
              <CardContent>
                <div className="supportpage-category-icon">{category.icon}</div>
                <h3 className="supportpage-category-title">{category.name}</h3>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="faq" className="supportpage-tabs-container">
          <TabsList>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="community">Community Forum</TabsTrigger>
            <TabsTrigger value="contact">Contact Us</TabsTrigger>
          </TabsList>
          <TabsContent value="faq">
            <Card>
              <CardContent>
                <h3 className="supportpage-section-title">Frequently Asked Questions</h3>
                <ul className="supportpage-faq-list">
                  {commonIssues.map((issue, index) => (
                    <li key={index} className="supportpage-faq-item">
                      <svg className="supportpage-faq-icon" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5l7 7-7 7"></path>
                      </svg>
                      {issue}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="community">
            <Card>
              <CardContent>
                <h3 className="supportpage-section-title">Join the Blueprint Community</h3>
                <p className="supportpage-community-text">Connect with other Blueprint users, share experiences, and get answers.</p>
                <Button>Visit Community Forum</Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="contact">
            <Card>
              <CardContent>
                <h3 className="supportpage-section-title">Contact Our Support Team</h3>
                <form className="supportpage-contact-form">
                  <Input placeholder="Your Name" />
                  <Input placeholder="Email Address" type="email" />
                  <Input placeholder="Subject" />
                  <textarea className="supportpage-textarea" rows={4} placeholder="Describe your issue"></textarea>
                  <Button className="supportpage-submit-button">Submit Request</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="supportpage-live-chat">
          <h3 className="supportpage-live-chat-title">Need Immediate Assistance?</h3>
          <Button className="supportpage-live-chat-button">
            Start Live Chat
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;