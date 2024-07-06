export function createPythonJobYaml(
  name: string,
  inputs: { name: string; value: string | number | null }[],
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
        python script.py ${inputs.map((input) => `$${input.name.toUpperCase()}`).join(" ")} > $TORK_OUTPUT
`;
}

export function createSQLJobYaml(
  name: string,
  inputs: { name: string; value: string | number }[],
  sqlQuery: string,
  dbConnectionSettings: {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  },
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
            import json
            import sys
            from datetime import date, datetime
            from decimal import Decimal

            import psycopg2
            from psycopg2.extras import RealDictCursor, RealDictRow

            def psycopg2_result_serializer(obj):
              if isinstance(obj, (date, datetime)):
                  return obj.isoformat()
              elif isinstance(obj, Decimal):
                  return float(obj)
              elif isinstance(obj, RealDictRow):
                  return {key: psycopg2_result_serializer(value) for key, value in obj.items()}
              elif isinstance(obj, dict):
                  return {key: psycopg2_result_serializer(value) for key, value in obj.items()}
              elif isinstance(obj, list):
                  return [psycopg2_result_serializer(item) for item in obj]
              elif isinstance(obj, set):
                  return list(obj)
              else:
                  return str(obj)

            def ${name.toLowerCase().replace(/ /g, "_")}(${inputs.map((input) => input.name).join(", ")}):
                connection = psycopg2.connect(
                    dbname="${dbConnectionSettings.database}",
                    user="${dbConnectionSettings.user}",
                    password="${dbConnectionSettings.password}",
                    host="${dbConnectionSettings.host}",
                    port=${dbConnectionSettings.port}
                )
                cursor = connection.cursor(cursor_factory=RealDictCursor)
                query = "${sqlQuery.replace(/\n/g, " ")}"
                cursor.execute(query${inputs && ", "}${inputs?.map((input) => input.name).join(", ")})
                rows = cursor.fetchall()
                result = []
                for row in rows:
                    data = {key: value for key, value in row.items()}
                    result.append(data)
                cursor.close()
                connection.close()
                return result

            if __name__ == "__main__":
                ${inputs
                  .map((input, idx) => `${input.name} = sys.argv[${idx + 1}]`)
                  .join("\n")}
                result = ${name.toLowerCase().replace(/ /g, "_")}(${inputs.map((input) => input.name).join(", ")})
                print(json.dumps({"response": result}, default=psycopg2_result_serializer))
    run: |
        pip install psycopg2
        python script.py ${inputs.map((input) => `$${input.name.toUpperCase()}`).join(" ")} > $TORK_OUTPUT
`;
}
