import React from 'react';

// Card component
const Card = ({ children, className }) => (
  <div className={`card ${className || ''}`}>{children}</div>
);

const CardContent = ({ children, className }) => (
  <div className={`card-content ${className || ''}`}>{children}</div>
);

// Input component
const Input = ({ type, placeholder, className }) => (
  <input type={type} placeholder={placeholder} className={`input ${className || ''}`} />
);

// Button component
const Button = ({ children, className, variant }) => (
  <button className={`button ${variant || ''} ${className || ''}`}>{children}</button>
);

// Checkbox component
const Checkbox = ({ id }) => (
  <input type="checkbox" id={id} className="checkbox" />
);

// LoginPage component
const LoginPage = () => {
  return (
    <div className="login-page">
      <Card className="login-card">
        <CardContent>
          <div className="login-header">
            <h1>Blueprint</h1>
            <p>Log in to your account</p>
          </div>
          
          <div className="login-form">
            <div className="input-group">
              <Input 
                type="email" 
                placeholder="Email" 
                className="input-with-icon"
              />
              <span className="input-icon">📧</span>
            </div>
            
            <div className="input-group">
              <Input 
                type="password" 
                placeholder="Password" 
                className="input-with-icon"
              />
              <span className="input-icon">🔒</span>
            </div>
            
            <div className="login-options">
              <div className="remember-me">
                <Checkbox id="remember" />
                <label htmlFor="remember">
                  Remember me
                </label>
              </div>
              <a href="#" className="forgot-password">
                Forgot password?
              </a>
            </div>
            
            <Button className="login-button">
              Log In
            </Button>
          </div>
          
          <div className="signup-prompt">
            <p>
              Don't have an account?{' '}
              <a href="#">
                Sign up
              </a>
            </p>
          </div>
          
          <div className="terms">
            <p>
              By logging in, you agree to Blueprint's Terms of Service and Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="help-button">
        <Button variant="ghost">
          Need Help?
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;