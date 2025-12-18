import React, { useState } from 'react';
import './EditBlueprintPage.css';

// Sample data (Replace with real data or props in production)
const sampleBlueprint = {
  businessName: 'Cafe Delight',
  businessType: 'Cafe',
  industry: 'Hospitality',
  website: 'https://cafedelight.com',
  blueprintGoals: [
    'Increase Customer Engagement',
    'Enhance Data Analytics',
  ],
  aiProvider: 'OpenAI',
  aiApiKey: '********', // Masked for security
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

const EditBlueprintPage = () => {
  const [blueprint, setBlueprint] = useState(sampleBlueprint);

  // State variables for form inputs
  const [businessName, setBusinessName] = useState(blueprint.businessName);
  const [businessType, setBusinessType] = useState(blueprint.businessType);
  const [industry, setIndustry] = useState(blueprint.industry);
  const [website, setWebsite] = useState(blueprint.website);
  const [blueprintGoals, setBlueprintGoals] = useState(blueprint.blueprintGoals);
  const [aiProvider, setAiProvider] = useState(blueprint.aiProvider);
  const [aiApiKey, setAiApiKey] = useState(blueprint.aiApiKey);
  const [operationalTools, setOperationalTools] = useState(blueprint.operationalTools);
  const [pois, setPois] = useState(blueprint.pois);

  const aiProviders = ['OpenAI', 'Anthropic', 'Google', 'Meta'];

  const handleSaveChanges = () => {
    // Implement save functionality
    // Update the blueprint state
    setBlueprint({
      businessName,
      businessType,
      industry,
      website,
      blueprintGoals,
      aiProvider,
      aiApiKey,
      operationalTools,
      pois,
    });
    alert('Changes saved successfully!');
    // Optionally redirect or navigate back to the dashboard
  };

  const handleCancel = () => {
    // Optionally navigate back or reset changes
    // For now, reset the form fields to the blueprint state
    setBusinessName(blueprint.businessName);
    setBusinessType(blueprint.businessType);
    setIndustry(blueprint.industry);
    setWebsite(blueprint.website);
    setBlueprintGoals(blueprint.blueprintGoals);
    setAiProvider(blueprint.aiProvider);
    setAiApiKey(blueprint.aiApiKey);
    setOperationalTools(blueprint.operationalTools);
    setPois(blueprint.pois);
  };

  const handleGoalChange = (goal) => {
    setBlueprintGoals((prevGoals) =>
      prevGoals.includes(goal)
        ? prevGoals.filter((g) => g !== goal)
        : [...prevGoals, goal]
    );
  };

  const handleOperationalToolChange = (tool) => {
    setOperationalTools((prevTools) =>
      prevTools.includes(tool)
        ? prevTools.filter((t) => t !== tool)
        : [...prevTools, tool]
    );
  };

  const handleAddPoi = () => {
    setPois([...pois, { name: '', actions: [''] }]);
  };

  const handleUpdatePoi = (index, updatedPoi) => {
    const newPois = [...pois];
    newPois[index] = updatedPoi;
    setPois(newPois);
  };

  const handleRemovePoi = (index) => {
    const newPois = [...pois];
    newPois.splice(index, 1);
    setPois(newPois);
  };

  return (
    <div className="edit-blueprint-container">
      <h1>Edit Blueprint</h1>
      <form className="edit-blueprint-form">
        <section>
          <h2>General Information</h2>
          <div className="form-group">
            <label>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Business Type</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">Select Industry</option>
              <option value="Retail">Retail</option>
              <option value="Hospitality">Hospitality</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Technology">Technology</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </section>

        <section>
          <h2>Blueprint Goals</h2>
          <div className="checkbox-group">
            {[
              'Increase Customer Engagement',
              'Improve Operational Efficiency',
              'Enhance Data Analytics',
              'Integrate Smart Technologies',
              'Boost Employee Productivity',
            ].map((goal) => (
              <div key={goal} className="checkbox-item">
                <input
                  type="checkbox"
                  id={goal}
                  checked={blueprintGoals.includes(goal)}
                  onChange={() => handleGoalChange(goal)}
                />
                <label htmlFor={goal}>{goal}</label>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>AI Model Provider</h2>
          <div className="form-group">
            <label>AI Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="">Select AI Provider</option>
              {aiProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
          {aiProvider && (
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </div>
          )}
        </section>

        <section>
          <h2>Operational Tools</h2>
          <div className="checkbox-group">
            {[
              'Inventory Management System',
              'Point of Sale (POS) System',
              'Customer Relationship Management (CRM)',
              'Accounting Software',
              'Project Management Tool',
            ].map((tool) => (
              <div key={tool} className="checkbox-item">
                <input
                  type="checkbox"
                  id={tool}
                  checked={operationalTools.includes(tool)}
                  onChange={() => handleOperationalToolChange(tool)}
                />
                <label htmlFor={tool}>{tool}</label>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Points of Interest</h2>
          {pois.map((poi, index) => (
            <div key={index} className="poi-section">
              <div className="poi-header">
                <h3>Point of Interest {index + 1}</h3>
                <button
                  type="button"
                  className="remove-poi-button"
                  onClick={() => handleRemovePoi(index)}
                >
                  Remove
                </button>
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={poi.name}
                  onChange={(e) =>
                    handleUpdatePoi(index, { ...poi, name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Actions</label>
                {poi.actions.map((action, actionIndex) => (
                  <div key={actionIndex} className="action-item">
                    <input
                      type="text"
                      value={action}
                      onChange={(e) => {
                        const newActions = [...poi.actions];
                        newActions[actionIndex] = e.target.value;
                        handleUpdatePoi(index, { ...poi, actions: newActions });
                      }}
                    />
                    <button
                      type="button"
                      className="remove-action-button"
                      onClick={() => {
                        const newActions = [...poi.actions];
                        newActions.splice(actionIndex, 1);
                        handleUpdatePoi(index, { ...poi, actions: newActions });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-action-button"
                  onClick={() => {
                    const newActions = [...poi.actions, ''];
                    handleUpdatePoi(index, { ...poi, actions: newActions });
                  }}
                >
                  Add Action
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="add-poi-button" onClick={handleAddPoi}>
            Add Point of Interest
          </button>
        </section>

        <div className="form-buttons">
          <button type="button" className="save-button" onClick={handleSaveChanges}>
            Save Changes
          </button>
          <button type="button" className="cancel-button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBlueprintPage;
