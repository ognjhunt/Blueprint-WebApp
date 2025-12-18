import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconName } from 'lucide-react';
import { Home, Building, Briefcase, ShoppingCart, Warehouse, Hotel, School, Hospital } from 'lucide-react';

const blueprintTypes = [
  { id: 'home', name: 'Home', icon: Home },
  { id: 'commercial', name: 'Commercial', icon: Building },
  { id: 'workplace', name: 'Workplace', icon: Briefcase },
  { id: 'grocery', name: 'Grocery Store', icon: ShoppingCart },
  { id: 'warehouse', name: 'Warehouse', icon: Warehouse },
  { id: 'hotel', name: 'Hotel', icon: Hotel },
  { id: 'school', name: 'School', icon: School },
  { id: 'hospital', name: 'Hospital', icon: Hospital }
];

const BlueprintTypeSelector = () => {
  const navigate = useNavigate();

  const handleSelectType = (typeId) => {
    navigate('/create-blueprint-flow', { state: { selectedType: typeId } });
  };

  return (
    <div className="typeselector-grid">
      {blueprintTypes.map((type) => (
        <button
          key={type.id}
          className="typeselector-type-button"
          onClick={() => handleSelectType(type.id)}
        >
          {React.createElement(type.icon, { className: "typeselector-type-icon" })}
          <span className="typeselector-type-name">{type.name}</span>
        </button>
      ))}
    </div>
  );
};

const BlueprintSetup = () => {
  return (
    <div className="typeselector-container">
      <h1 className="typeselector-title">Select Blueprint Type</h1>
      <BlueprintTypeSelector />
    </div>
  );
};

export default BlueprintSetup;