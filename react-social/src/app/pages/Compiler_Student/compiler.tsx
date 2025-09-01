import Splitter, { SplitDirection } from "@devbookhq/splitter";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/hint/show-hint";
import "codemirror/lib/codemirror.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/theme/material.css";
import { useEffect, useState } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import Select from "react-select";
import { CompilerQuestion } from "./compilerQuestion";
import { CompilerTabs } from "./compilerTabs";
import { ReadLanguages } from "./compiler_APIs";
import "./custom_style.css";

import "codemirror/addon/hint/javascript-hint";

import "codemirror/addon/fold/brace-fold";
import "codemirror/addon/fold/comment-fold";
import "codemirror/addon/fold/foldcode";
import "codemirror/addon/fold/foldgutter";
import "codemirror/addon/fold/foldgutter.css";
import "codemirror/addon/hint/anyword-hint";
import "codemirror/addon/hint/show-hint.css";

import UseAnimations from "react-useanimations";
import settings from "react-useanimations/lib/settings";

import maximizeMinimize2 from "react-useanimations/lib/maximizeMinimize2";

import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";

const Compiler = () => {
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [solution, setSolution] = useState("");
  const [testCase, setTestCase] = useState([1]);
  const [languageOptionData, setLanguageOptionsData] = useState([
    { label: "", value: 0 },
  ]);
  const [languageDefaultOptionData, setLanguageDataDefault] = useState({
    label: "",
    value: 0,
  });
  const [testCaseCounter, setTestCaseCounter] = useState(2);
  const [codingQuestionId, setCodingQuestionId] = useState(0);
  const [codingQuestionSubmitted, setCodingQuestionSubmitted] = useState(false);
  const [language_id, setLanguage_id] = useState(50);

  useEffect(() => {
    setLoading(true);
    try {
      ReadLanguages().then((data: any) => {
        var languageOptions: any = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });

        var languageOptions1: any = [
          { label: "C (GCC 9.2.0)", value: 50 },
          { label: "C++ (GCC 9.2.0)", value: 54 },
          { label: "Java (OpenJDK 13.0.1)", value: 62 },
          { label: "JavaScript (Node.js 12.14.0)", value: 63 },
          { label: "Python (3.8.1)", value: 71 },
        ];

        setLanguageOptionsData(languageOptions1);
        setLanguageDataDefault({
          label: languageOptions[9].label,
          value: languageOptions[9].value,
        });
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const [code, setCode] = useState(
    `#include <stdio.h>\n\nint main(void) {\n  char name[10];\n  scanf(\"%s\", name);\n  printf(\"hello, %s\\n\", name);\n  return 0;\n}`
  );

  return (
    <>
      <Splitter direction={SplitDirection.Horizontal}>
        <div className="left-pan">
          <CompilerQuestion
            setCodingQuestionId={setCodingQuestionId}
            setCodingQuestionSubmitted={setCodingQuestionSubmitted}
          />
        </div>

        <div className="right-pan">
          {loading && (
            <span
              className="indicator-progress m-10"
              style={{ display: "block" }}
            >
              Please wait...{" "}
              <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
            </span>
          )}

          {!loading && (
            <>
              <div className="form-group mt-3 px-5 text-center d-flex">
                <label className="control-label col-md-4 pt-3 d-flex">
                  <UseAnimations
                    animation={settings}
                    size={26}
                    speed={0.5}
                    strokeColor={"#009EF7"}
                    autoplay={true}
                    loop={true}
                  />{" "}
                  <h3 className="px-5">Coding Language :</h3>
                </label>

                <div className="col-md-7">
                  <Select
                    name="language_id"
                    options={languageOptionData}
                    placeholder="Choose Language"
                    loadingMessage={() => "Fetching Languages"}
                    noOptionsMessage={() => "No Language Availabel"}
                    defaultValue={{
                      label: languageDefaultOptionData.label,
                      value: languageDefaultOptionData.value,
                    }}
                    onChange={(option: any) => {
                      setLanguage_id(option.value);
                    }}
                  />
                </div>

                <button
                  className="btn bg-body mx-12 py-0 px-2"
                  onClick={() => {
                    if (!isFullScreen) {
                      document.documentElement.requestFullscreen();
                    } else {
                      document.exitFullscreen();
                    }

                    setIsFullScreen(!isFullScreen);
                  }}
                >
                  <UseAnimations
                    animation={maximizeMinimize2}
                    size={26}
                    strokeColor={"#009EF7"}
                  />
                </button>
              </div>

              <div className="form-group px-3 py-3 d-flex">
                <div className="col-md">
                  <CodeMirror
                    value={code}
                    className="code-mirror-wrapper"
                    options={{
                      lineWrapping: true,
                      lint: true,
                      smartIndent: true,
                      foldGutter: true,
                      gutters: [
                        "CodeMirror-linenumbers",
                        "CodeMirror-foldgutter",
                      ],
                      mode: "javascript",
                      theme: "dracula",
                      lineNumbers: true,
                      autoCloseTags: true,
                      autoCloseBrackets: true,
                      extraKeys: {
                        "Ctrl-Space": "autocomplete",
                      },
                    }}
                    onChange={(editor, data, value) => {
                      setCode(value);
                    }}
                  />
                </div>
              </div>

              <Tabs
                defaultActiveKey={"test_case_1"}
                id="uncontrolled-tab-example"
                className="mb-3"
              >
                {testCase.map((data: any, id: any) => (
                  <Tab
                    key={id}
                    eventKey={"test_case_" + data}
                    title={"Test Case " + data}
                  >
                    <CompilerTabs
                      language_id={language_id}
                      code={code}
                      testCaseCounter={testCaseCounter}
                      setTestCaseCounter={setTestCaseCounter}
                      testCase={testCase}
                      codingQuestionId={codingQuestionId}
                      codingQuestionSubmitted={codingQuestionSubmitted}
                      data={data}
                      id={id}
                    />
                  </Tab>
                ))}
              </Tabs>
            </>
          )}
        </div>
      </Splitter>
    </>
  );
};

export default Compiler;
