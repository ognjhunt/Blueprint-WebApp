import React from 'react';

const Card = ({ className, children }) => (
  <div className={`landingpage-card ${className}`}>
    {children}
  </div>
);

const CardContent = ({ className, children }) => (
  <div className={`landingpage-card-content ${className}`}>
    {children}
  </div>
);

const Button = ({ size, children }) => (
  <button className={`landingpage-button landingpage-button-${size}`}>
    {children}
  </button>
);

const AboutPage = () => {
  return (
    <div className="landingpage-container">
      <h1 className="landingpage-title">About Blueprint</h1>
      
      <div className="landingpage-intro">
        <p className="landingpage-intro-text">
          Blueprint is the future of personalized experiences, powered by smart glasses technology.
        </p>
        <p className="landingpage-intro-subtext">
          Create, automate, and optimize spaces for the age of augmented reality.
        </p>
      </div>
      
      <div className="landingpage-vision-mission">
        <Card className="landingpage-vision-card">
          <CardContent>
            <h2 className="landingpage-section-title">Our Vision</h2>
            <p>
              We envision a world where every space, from homes to businesses, 
              adapts intelligently to individual needs, enhancing daily life through 
              seamless, personalized experiences.
            </p>
          </CardContent>
        </Card>
        <Card className="landingpage-mission-card">
          <CardContent>
            <h2 className="landingpage-section-title">Our Mission</h2>
            <p>
              To empower individuals and businesses to create immersive, 
              responsive environments that revolutionize how we interact 
              with our surroundings.
            </p>
          </CardContent>
        </Card>
      </div>
      
      <h2 className="landingpage-section-title landingpage-centered">How Blueprint Works</h2>
      
      <div className="landingpage-steps">
        {[
          { title: "Design", icon: "🎨", description: "Create your ideal space layout and interaction points." },
          { title: "Automate", icon: "⚙️", description: "Set up smart triggers and responsive actions." },
          { title: "Experience", icon: "👓", description: "Bring your space to life through smart glasses." },
        ].map((step, index) => (
          <Card key={index} className="landingpage-step-card">
            <CardContent>
              <div className="landingpage-step-icon">{step.icon}</div>
              <h3 className="landingpage-step-title">{step.title}</h3>
              <p>{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <h2 className="landingpage-section-title landingpage-centered">Key Features</h2>
      
      <div className="landingpage-features">
        {[
          "Intuitive AR Interface",
          "Real-time Analytics",
          "Customizable Triggers",
          "Multi-location Management",
          "Privacy Controls",
          "Integration Ecosystem",
        ].map((feature, index) => (
          <Card key={index} className="landingpage-feature-card">
            <CardContent>
              <div className="landingpage-feature-icon"></div>
              <span className="landingpage-feature-text">{feature}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="landingpage-cta">
        <h2 className="landingpage-cta-title">Ready to Shape the Future?</h2>
        <p className="landingpage-cta-text">
          Join us in creating spaces that adapt, respond, and enhance every interaction.
        </p>
        <Button size="lg">Get Started with Blueprint</Button>
      </div>
      
      <div className="landingpage-footer">
        <p>Blueprint Technologies Inc.</p>
        <p>Innovating at the intersection of AR and spatial design since 2024.</p>
      </div>
    </div>
  );
};

export default AboutPage;