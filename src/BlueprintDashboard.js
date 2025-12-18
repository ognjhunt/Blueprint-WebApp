import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './BlueprintDashboard.css';

// Sample data (Replace with real data in production)
const sampleBlueprint = {
  businessName: 'Cafe Delight',
  businessType: 'Cafe',
  industry: 'Hospitality',
  website: 'https://cafedelight.com',
  blueprintGoals: [
    'Increase Customer Engagement',
    'Enhance Data Analytics',
  ],
  operationalTools: [
    'Point of Sale (POS) System',
    'Customer Relationship Management (CRM)',
  ],
  pois: [
    {
      name: 'Counter/Service Area',
      actions: [
        'Display menu options when approached',
        'Provide estimated wait times',
        'Offer personalized drink recommendations',
        'Enable voice ordering',
      ],
    },
    {
      name: 'Menu Board',
      actions: [
        'Provide detailed descriptions of menu items',
        'Highlight daily specials or promotions',
        'Offer nutritional information',
        'Allow voice-activated queries',
      ],
    },
    // Add more POIs as needed
  ],
};

const BlueprintDashboard = () => {
  const [blueprint, setBlueprint] = useState(sampleBlueprint);
  const navigate = useNavigate(); // Initialize navigate

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>{blueprint.businessName} Dashboard</h1>
        <nav className="dashboard-nav">
          <a href="#overview">Overview</a>
          <a href="#pois">Points of Interest</a>
          <a href="#analytics">Analytics</a>
          <a href="#settings">Settings</a>
        </nav>
      </header>

      <main className="dashboard-main">
        {/* Overview Section */}
        <section id="overview" className="dashboard-section">
          <h2>Overview</h2>
          <div className="overview-cards">
            <div className="card">
              <h3>Business Type</h3>
              <p>{blueprint.businessType}</p>
            </div>
            <div className="card">
              <h3>Industry</h3>
              <p>{blueprint.industry}</p>
            </div>
            <div className="card">
              <h3>Website</h3>
              <p>
                <a href={blueprint.website} target="_blank" rel="noopener noreferrer">
                  {blueprint.website}
                </a>
              </p>
            </div>
            <div className="card">
              <h3>Blueprint Goals</h3>
              <ul>
                {blueprint.blueprintGoals.map((goal, index) => (
                  <li key={index}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>Operational Tools</h3>
              <ul>
                {blueprint.operationalTools.map((tool, index) => (
                  <li key={index}>{tool}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Points of Interest Section */}
        <section id="pois" className="dashboard-section">
          <h2>Points of Interest</h2>
          <div className="pois-list">
            {blueprint.pois.map((poi, index) => (
              <div key={index} className="poi-card">
                <h3>{poi.name}</h3>
                <ul>
                  {poi.actions.map((action, actionIndex) => (
                    <li key={actionIndex}>{action}</li>
                  ))}
                </ul>
                {/* Optionally, add buttons to edit or delete POIs */}
              </div>
            ))}
          </div>
          {/* Button to add new POI */}
          <button className="add-poi-button">Add New Point of Interest</button>
        </section>

        {/* Analytics Section */}
        <section id="analytics" className="dashboard-section">
          <h2>Analytics</h2>
          <p>Coming soon! Here you'll be able to see insights and analytics based on your blueprint.</p>
          {/* Placeholder for future analytics charts and data */}
        </section>

        {/* Settings Section */}
        <section id="settings" className="dashboard-section">
          <h2>Settings</h2>
          <p>Manage your blueprint settings and preferences.</p>
          {/* Options to edit blueprint, change settings, etc. */}
          <button
            className="edit-blueprint-button"
            onClick={() => navigate('/edit-blueprint')} // Navigate to EditBlueprintPage
          >
            Edit Blueprint
          </button>
        </section>
      </main>

      <footer className="dashboard-footer">
        <p>&copy; {new Date().getFullYear()} Blueprint</p>
      </footer>
    </div>
  );
};

export default BlueprintDashboard;
