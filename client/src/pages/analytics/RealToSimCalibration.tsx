import { SEO } from "@/components/SEO";
import { ArrowRight, Settings, Zap, Target, CheckCircle2, Wrench, TrendingUp } from "lucide-react";

export default function RealToSimCalibration() {
  return (
    <>
      <SEO
        title="Real-to-Sim Calibration | Blueprint - Hardware Fingerprinting"
        description="Automatically measure your robot's actual physics parameters. Friction, damping, mass, sensor calibration. Close the sim-to-real gap without manual tuning."
        canonical="/analytics/real-to-sim-calibration"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-700 backdrop-blur-sm">
                <Wrench className="h-4 w-4" />
                Hardware Calibration
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Real-to-Sim Calibration Service
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Automatically measure your physical robot's actual parameters and update simulation models. Skip months of manual calibration. Close the sim-to-real gap with quantified hardware fingerprints.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">90%</div>
                <p className="mt-2 text-sm text-zinc-600">Calibration accuracy (vs. 40% manual)</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">4-6 weeks</div>
                <p className="mt-2 text-sm text-zinc-600">Time saved vs. manual calibration</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$50K+</div>
                <p className="mt-2 text-sm text-zinc-600">Labor cost savings per robot</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=real-to-sim-calibration"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Calibration Service
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/analytics"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                View All Modules
              </a>
            </div>
          </div>
        </section>

        {/* Calibration Parameters */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">What We Measure</h2>
                <p className="mt-2 text-zinc-600">
                  Comprehensive hardware fingerprinting across all robot dimensions
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Kinematics & Mechanics",
                    description: "Measure actual joint ranges, dynamics, and stiction",
                    params: [
                      "Joint range of motion (actual vs. CAD)",
                      "Joint friction/stiction coefficients",
                      "Link mass distribution",
                      "Backlash and hysteresis per joint",
                      "Gear ratios and transmission efficiency",
                    ],
                  },
                  {
                    title: "End-Effector Parameters",
                    description: "Characterize gripper/tool actual behavior",
                    params: [
                      "Gripper closure force vs. command curve",
                      "Gripper closing speed profile",
                      "Finger contact compliance",
                      "Tool mass and center of gravity",
                      "Tool-mounted sensor calibration",
                    ],
                  },
                  {
                    title: "Sensor Calibration",
                    description: "Measure actual sensor characteristics and biases",
                    params: [
                      "Camera intrinsic matrix (focal length, principal point)",
                      "Depth sensor noise profile",
                      "IMU bias and scale factors",
                      "Force/torque sensor calibration",
                      "Joint encoder zero offsets",
                    ],
                  },
                  {
                    title: "Contact Dynamics",
                    description: "Characterize how the robot interacts with objects",
                    params: [
                      "Friction coefficients (gripper-object material pairs)",
                      "Contact compliance and damping",
                      "Restitution coefficients",
                      "Finger contact area and pressure distribution",
                      "Surface material properties",
                    ],
                  },
                  {
                    title: "Control System Parameters",
                    description: "Measure actuator and control loop characteristics",
                    params: [
                      "Motor torque-current relationship",
                      "Motor speed command response time",
                      "Control loop latency",
                      "Command saturation/limits",
                      "Position control PID characteristics",
                    ],
                  },
                  {
                    title: "Environmental Factors",
                    description: "Account for real-world conditions",
                    params: [
                      "Gravity vector and orientation",
                      "Temperature effects on parameters",
                      "Wear and degradation rates",
                      "Cable/hose routing effects",
                      "Power supply voltage variations",
                    ],
                  },
                ].map((category, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{category.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{category.description}</p>
                    <ul className="mt-4 space-y-2">
                      {category.params.map((param, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-600 shrink-0" />
                          {param}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Calibration Process */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Calibration Methodology</h2>
              <p className="mt-2 text-zinc-600">
                How we extract physics parameters from your real robot
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "System Integration",
                  description: "Connect to your robot's control interface and sensor streams (ROS, proprietary APIs)",
                },
                {
                  step: "2",
                  title: "Executable Test Sequences",
                  description: "Run automated test movements (joint sweeps, grasp tests, impact tests) on your hardware",
                },
                {
                  step: "3",
                  title: "Data Collection",
                  description: "Capture sensor readings, motor currents, position tracking, force measurements",
                },
                {
                  step: "4",
                  title: "Parameter Estimation",
                  description: "Use system identification & optimization algorithms to extract physics parameters",
                },
                {
                  step: "5",
                  title: "Model Validation",
                  description: "Verify estimated parameters by simulating test movements and comparing to real data",
                },
                {
                  step: "6",
                  title: "Simulation Update",
                  description: "Automatically update your URDF/USD simulation files with measured parameters",
                },
                {
                  step: "7",
                  title: "Hardware Fingerprint Report",
                  description: "Deliver documentation of all measured parameters and calibration quality metrics",
                },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-100">
                    <span className="font-bold text-cyan-700">{step.step}</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-zinc-200 bg-white p-6">
                    <h3 className="font-semibold text-zinc-950">{step.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Output & Deliverables */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Calibration Deliverables</h2>
                <p className="mt-2 text-zinc-600">
                  Everything you need to upgrade your simulation
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "Updated URDF Model",
                    description: "Robot description file with calibrated parameters",
                    files: [
                      "robot.urdf with measured masses, CoMs",
                      "Joint friction/damping coefficients",
                      "Actuator dynamics models",
                      "Sensor mounting calibration",
                    ],
                  },
                  {
                    title: "Physics Parameters JSON",
                    description: "Structured parameter export for your simulator",
                    files: [
                      "Joint parameters (friction, stiction, limits)",
                      "Link inertias and masses",
                      "Sensor calibration matrices",
                      "Contact material properties",
                    ],
                  },
                  {
                    title: "Calibration Report",
                    description: "Detailed documentation of measurement process and results",
                    files: [
                      "Parameter values with confidence intervals",
                      "Validation test results",
                      "Deviation from CAD (itemized)",
                      "Recommendations for simulation tuning",
                    ],
                  },
                  {
                    title: "Validation Dataset",
                    description: "Real vs. simulated comparison data",
                    files: [
                      "Test trajectories with ground truth",
                      "Sensor comparison plots",
                      "Contact force validation",
                      "Quantified accuracy metrics",
                    ],
                  },
                ].map((deliverable, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{deliverable.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{deliverable.description}</p>
                    <ul className="mt-4 space-y-2">
                      {deliverable.files.map((file, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-600 shrink-0" />
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Who Benefits</h2>
              <p className="mt-2 text-zinc-600">
                Common use cases for hardware calibration
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "New Robot Deployment",
                  description: "Get accurate sim models before training",
                  example: "Calibrate fresh UR10 before starting RL training pipeline",
                },
                {
                  title: "Simulation Accuracy Issues",
                  description: "Debug why simulation doesn't match reality",
                  example: "Discover gripper friction is 3x higher than CAD, update simulation",
                },
                {
                  title: "Multi-Robot Normalization",
                  description: "Characterize variations across your robot fleet",
                  example: "Calibrate 10 identical robots, identify which one needs maintenance",
                },
                {
                  title: "Hardware Maintenance",
                  description: "Track degradation over time with periodic recalibration",
                  example: "Annual recalibration shows gripper wear, plan replacement",
                },
              ].map((useCase, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{useCase.description}</p>
                  <div className="mt-4 rounded-lg bg-cyan-50 p-3">
                    <p className="text-xs text-cyan-700 font-medium">{useCase.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Why Calibration Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Skip Tedious Manual Work</h3>
                  <p className="mt-3 text-zinc-600">
                    Manual calibration takes 4-6 weeks of engineering time. Automated measurement runs in 2-3 days.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Higher Accuracy</h3>
                  <p className="mt-3 text-zinc-600">
                    System identification extracts 90%+ accurate parameters. Manual tuning typically achieves 40-50%.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Reduce Sim-to-Real Gap</h3>
                  <p className="mt-3 text-zinc-600">
                    Closing calibration loop means policies trained in simulation transfer better to real robots.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Maintenance Insights</h3>
                  <p className="mt-3 text-zinc-600">
                    Periodic recalibration reveals hardware degradation before it causes failures.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-950">
              Real-to-Sim Calibration Service
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Available as add-on to Professional and Enterprise tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Price per Robot
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$6,000-$20,000</p>
              <p className="mt-2 text-sm text-zinc-600">depending on robot complexity (industrial arms: $10-20K, collaborative robots: $6-12K)</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=real-to-sim-calibration&tier=professional"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Calibration Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=real-to-sim-calibration"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
