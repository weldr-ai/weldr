export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export type DatabaseStructure = Table[];

export interface Table {
  name: string;
  columns: Column[];
  relationships: Relationship[];
}

export interface Column {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface Relationship {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}
