import React, { useState } from 'react';

const quizQuestions = [
  {
    question: "What best describes your business or space?",
    options: ["Retail Store", "Office", "Restaurant", "Home", "Educational Institution", "Healthcare Facility"],
  },
  {
    question: "How many people typically occupy your space daily?",
    options: ["1-10", "11-50", "51-200", "201-500", "500+"],
  },
  {
    question: "What's your primary goal for implementing a Blueprint?",
    options: ["Improve Customer Experience", "Increase Efficiency", "Enhance Security", "Energy Management", "Space Optimization"],
  },
  {
    question: "How tech-savvy is your typical user or customer?",
    options: ["Not at all", "Somewhat familiar", "Very comfortable with technology", "Mix of all levels"],
  },
  {
    question: "What's your budget range for this project?",
    options: ["Under $1,000", "$1,000 - $5,000", "$5,000 - $20,000", "$20,000+", "Not sure yet"],
  }
];

const Card = ({ children }) => (
  <div className="blueprint-card">{children}</div>
);

const CardContent = ({ children }) => (
  <div className="blueprint-card-content">{children}</div>
);

const Button = ({ onClick, disabled, children }) => (
  <button className="blueprint-button" onClick={onClick} disabled={disabled}>{children}</button>
);

const Progress = ({ value }) => (
  <div className="blueprint-progress-container">
    <div className="blueprint-progress-bar" style={{ width: `${value}%` }}></div>
  </div>
);

const RadioGroup = ({ children }) => (
  <div className="blueprint-radio-group">{children}</div>
);

const RadioGroupItem = ({ value, id }) => (
  <input type="radio" className="blueprint-radio-item" value={value} id={id} />
);

const Label = ({ htmlFor, children }) => (
  <label className="blueprint-label" htmlFor={htmlFor}>{children}</label>
);

const BlueprintQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);

  const handleAnswer = (answer) => {
    setAnswers([...answers, answer]);
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz completed logic here
      console.log("Quiz completed", answers);
    }
  };

  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;

  return (
    <div className="blueprint-container">
      <h1 className="blueprint-title">Create/Build Your Ideal Blueprint</h1>
      
      <Progress value={progress} />
      
      <Card>
        <CardContent>
          <h2 className="blueprint-question">
            {quizQuestions[currentQuestion].question}
          </h2>
          <RadioGroup>
            {quizQuestions[currentQuestion].options.map((option, index) => (
              <div key={index} className="blueprint-option">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      
      <div className="blueprint-button-container">
        <Button 
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
        >
          Previous
        </Button>
        <Button onClick={() => handleAnswer(null)}>
          {currentQuestion === quizQuestions.length - 1 ? "Finish" : "Next"}
        </Button>
      </div>
      <p className="blueprint-question-counter">
        Question {currentQuestion + 1} of {quizQuestions.length}
      </p>
    </div>
  );
};

export default BlueprintQuiz;