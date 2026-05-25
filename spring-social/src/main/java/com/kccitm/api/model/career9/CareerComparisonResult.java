package com.kccitm.api.model.career9;

import java.util.List;

public class CareerComparisonResult {

    private CareerSuggestionResult programResult;  // Rule-based output
    private CareerSuggestionResult llmResult;      // Qwen3 output
    private List<String> agreements;               // Career titles both agree on
    private List<String> disagreements;            // Career titles that differ

    public CareerSuggestionResult getProgramResult() { return programResult; }
    public void setProgramResult(CareerSuggestionResult programResult) { this.programResult = programResult; }

    public CareerSuggestionResult getLlmResult() { return llmResult; }
    public void setLlmResult(CareerSuggestionResult llmResult) { this.llmResult = llmResult; }

    public List<String> getAgreements() { return agreements; }
    public void setAgreements(List<String> agreements) { this.agreements = agreements; }

    public List<String> getDisagreements() { return disagreements; }
    public void setDisagreements(List<String> disagreements) { this.disagreements = disagreements; }
}
