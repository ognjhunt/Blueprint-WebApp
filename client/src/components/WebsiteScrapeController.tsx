tion = (data) => {
    // Default configuration
    return {
      name: "Customer Feedback",
      feedbackMethod: "form",
      fields: {
        rating: true,
        comments: true,
        name: true,
        email: true,
        contactBack: false,
      },
      followUp: false,
    };
  };

  // Main scrape process
  const startScraping = async () => {
    if (!businessUrl || !blueprintId || selectedUseCases.length === 0) {
      setError("Missing required information to start scraping");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Discovery phase
      const relevantUrls = await discoverRelevantPages(businessUrl);

      // 2. Scraping phase
      const scrapedResults = await scrapePages(relevantUrls);
      setScrapedData(scrapedResults);

      // 3. Parsing phase
      const configs = await parseScrapedContent(scrapedResults);
      setExtractedConfigs(configs);

      // 4. Save to Firebase
      await saveConfigurationsToFirebase(configs);

      // 5. Complete
      setCurrentStep("complete");
      setStatusMessage("Website analysis complete!");
      setProgress(100);

      toast({
        title: "Website Analysis Complete",
        description: `Successfully analyzed your website and extracted configurations for ${Object.keys(configs).length} features.`,
        variant: "success",
        duration: 5000,
      });

      // 6. Call the onComplete callback with the extracted configs
      if (onComplete) {
        onComplete(configs);
      }
    } catch (error) {
      console.error("Error in scraping process:", error);
      setError("Failed to complete the website analysis. " + error.message);

      toast({
        title: "Analysis Failed",
        description:
          "We couldn't complete the website analysis. You can skip this step and configure manually.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save the extracted configurations to Firebase
  const saveConfigurationsToFirebase = async (configs) => {
    try {
      // Update the blueprint document with the extracted configurations
      const blueprintRef = doc(db, "blueprints", blueprintId);

      await updateDoc(blueprintRef, {
        featureConfigurations: configs,
        extractedFromWebsite: true,
        extractedAt: new Date().toISOString(),
        updatedAt: new Date(),
      });

      // Also save the scraped data to a separate collection for reference
      const scrapedDataRef = doc(db, "scrapedData", blueprintId);

      await setDoc(scrapedDataRef, {
        blueprintId,
        scrapedData,
        createdAt: new Date(),
        businessUrl,
      });

      return true;
    } catch (error) {
      console.error("Error saving configurations to Firebase:", error);
      throw new Error("Failed to save configurations: " + error.message);
    }
  };

  // Effect to start scraping when component mounts
  useEffect(() => {
    if (!isLoading && currentStep === "init" && businessUrl) {
      startScraping();
    }
  }, [businessUrl, blueprintId]);

  // Helper to get icon for current step
  const getStepIcon = () => {
    switch (currentStep) {
      case "discovery":
        return <Globe className="h-8 w-8 text-blue-500" />;
      case "scraping":
        return <FileText className="h-8 w-8 text-green-500" />;
      case "parsing":
        return <Cpu className="h-8 w-8 text-purple-500" />;
      case "complete":
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />;
      default:
        return <Loader2 className="h-8 w-8 text-gray-500 animate-spin" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="border-b py-4 px-6 flex justify-between items-center bg-white">
        <div className="flex items-center">
          <ExternalLink className="h-6 w-6 text-indigo-500 mr-2" />
          <span className="font-semibold text-xl">Website Analysis</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            {getStepIcon()}
            <h2 className="text-2xl font-bold mt-4">
              {currentStep === "init" && "Preparing to analyze your website..."}
              {currentStep === "discovery" && "Discovering relevant pages..."}
              {currentStep === "scraping" && "Scraping website content..."}
              {currentStep === "parsing" &&
                "Analyzing and extracting configurations..."}
              {currentStep === "complete" && "Analysis Complete!"}
            </h2>
            <p className="text-gray-600 mt-2">{statusMessage}</p>
          </div>

          <Progress value={progress} className="h-2 mb-8" />

          {/* Feature boxes showing progress */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {selectedUseCases.map((useCase) => (
              <div
                key={useCase}
                className={`border rounded-lg p-4 text-center transition-all ${
                  Object.keys(extractedConfigs).includes(useCase)
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                  {useCaseIcons[useCase] || <Info className="h-5 w-5" />}
                </div>
                <p className="font-medium text-sm">
                  {useCase.charAt(0).toUpperCase() +
                    useCase.slice(1).replace(/([A-Z])/g, " $1")}
                </p>
                {Object.keys(extractedConfigs).includes(useCase) ? (
                  <p className="text-xs text-green-600 mt-1">✓ Configured</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Analyzing...</p>
                )}
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">An error occurred</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Information about what's happening */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">
              What's happening?
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              We're analyzing your website to automatically configure your
              Blueprint features. This process includes:
            </p>
            <ul className="space-y-2 text-sm text-blue-700">
              <li className="flex items-start">
                <div
                  className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mr-2 mt-0.5 ${currentStep === "discovery" ? "bg-blue-500 text-white" : currentStep === "complete" || currentStep === "scraping" || currentStep === "parsing" ? "bg-green-500 text-white" : "bg-gray-200"}`}
                >
                  {currentStep === "complete" ||
                  currentStep === "scraping" ||
                  currentStep === "parsing" ? (
                    <Check className="h-3 w-3" />
                  ) : currentStep === "discovery" ? (
                    "1"
                  ) : (
                    "1"
                  )}
                </div>
                <span>
                  Discovering relevant pages for your selected features
                </span>
              </li>
              <li className="flex items-start">
                <div
                  className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mr-2 mt-0.5 ${currentStep === "scraping" ? "bg-blue-500 text-white" : currentStep === "complete" || currentStep === "parsing" ? "bg-green-500 text-white" : "bg-gray-200"}`}
                >
                  {currentStep === "complete" || currentStep === "parsing" ? (
                    <Check className="h-3 w-3" />
                  ) : currentStep === "scraping" ? (
                    "2"
                  ) : (
                    "2"
                  )}
                </div>
                <span>Scraping content from these pages</span>
              </li>
              <li className="flex items-start">
                <div
                  className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mr-2 mt-0.5 ${currentStep === "parsing" ? "bg-blue-500 text-white" : currentStep === "complete" ? "bg-green-500 text-white" : "bg-gray-200"}`}
                >
                  {currentStep === "complete" ? (
                    <Check className="h-3 w-3" />
                  ) : currentStep === "parsing" ? (
                    "3"
                  ) : (
                    "3"
                  )}
                </div>
                <span>Analyzing content to configure your features</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-6 flex justify-end">
        {currentStep === "complete" ? (
          <Button onClick={() => onComplete && onComplete(extractedConfigs)}>
            Continue to Blueprint Setup
          </Button>
        ) : (
          <Button variant="outline" onClick={() => onSkip && onSkip()}>
            Skip & Configure Manually
          </Button>
        )}
      </div>
    </div>
  );
};
