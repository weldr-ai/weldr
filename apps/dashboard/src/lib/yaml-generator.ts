export function createPythonJob(
  name: string,
  inputs: { name: string; value: string }[],
  functionCode: string,
) {
  return `
name: ${name}
output: "{{ tasks.response }}"
inputs:
  ${inputs.map((input) => `${input.name}: ${input.value}`).join("\n")}
tasks:
  - name: ${name}
    var: response
    image: python:latest
    env:
      ${inputs.map((input) => `${input.name.toUpperCase()}: "{{ inputs.${input.name} }}"`).join("\n")}
    files:
        script.py: |
          import sys
          import json
          ${functionCode.replace(/\n/g, "\n          ")}
          if __name__ == "__main__":
            ${inputs
              .map((input, idx) => `${input.name} = sys.argv[${idx + 1}]`)
              .join("\n")}
            response = ${name.toLowerCase().replace(/ /g, "_")}(${inputs.map((input) => input.name).join(", ")})
            print(json.dumps(response))
    run: |
        pip install requests
        python script.py ${inputs.map((input) => `$${input.name.toUpperCase()}`).join(" ")} > $TORK_OUTPUT
`;
}
