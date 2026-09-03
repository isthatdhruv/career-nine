import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import QuestionSectionPage from "./CreateQuestionSection";
import { ReadQuestionSectionData } from "./API/Question_Section_APIs";

jest.mock("./API/Question_Section_APIs", () => ({
  ReadQuestionSectionData: jest.fn(),
  DeleteQuestionSectionData: jest.fn(),
  GetDeletedQuestionSections: jest.fn(() => Promise.resolve({ data: [] })),
  RestoreQuestionSection: jest.fn(),
  PermanentDeleteQuestionSection: jest.fn(),
}));

// Stub the MDB-backed table: same props contract, no third-party rendering.
jest.mock("./components/QuestionSectionTable", () => {
  const React = require("react");
  return (props: any) =>
    React.createElement(
      "div",
      null,
      React.createElement("span", { "data-testid": "row-count" }, props.data.length),
      React.createElement(
        "button",
        {
          onClick: () => {
            // Mirrors QuestionSectionTable's delete handler sequence.
            props.setLoading(true);
            props.setPageLoading(["true"]);
            props.setLoading(false);
          },
        },
        "simulate-delete"
      )
    );
});

jest.mock("./components/QuestionSectionRecycleBinModal", () => () => null);

const sections = [
  { sectionId: 1, sectionName: "Aptitude", sectionDescription: "Numerical" },
  { sectionId: 2, sectionName: "Interest", sectionDescription: "RIASEC" },
];

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <QuestionSectionPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  (ReadQuestionSectionData as jest.Mock).mockReset();
  (ReadQuestionSectionData as jest.Mock).mockResolvedValue({ data: sections });
});

test("renders the section list once the lookup resolves", async () => {
  renderPage();
  expect(await screen.findByTestId("row-count")).toHaveTextContent("2");
});

test("refetches the sections after the table reports a delete", async () => {
  renderPage();
  await screen.findByTestId("row-count");
  expect(ReadQuestionSectionData).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText("simulate-delete"));

  await waitFor(() => expect(ReadQuestionSectionData).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId("row-count")).toHaveTextContent("2");
});
