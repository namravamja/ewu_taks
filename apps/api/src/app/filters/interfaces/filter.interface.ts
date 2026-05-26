import { FilterType } from '@mediastar/database';

export interface ICreateFilterRequest {
	field: string;
	label: string;
	type: FilterType;
	operators?: unknown;
	dependencies?: unknown;
	isMulti?: boolean;
	isRequired?: boolean;
	isActive?: boolean;
	dataSource?: string;
	placeholder?: string;
}

export interface IFilterConfigResponse {
	field: string;
	label: string;
	type: FilterType;
	operators: string[];
	dependencies: Record<string, unknown>;
}

export interface IFilterMutationResult {
	id: number;
	field: string;
	label: string;
	type: FilterType;
	operators: unknown | null;
	dependencies: unknown | null;
	isMulti: boolean;
	isRequired: boolean;
	isActive: boolean;
	dataSource: string | null;
	placeholder: string | null;
	createdAt: Date;
	updatedAt: Date;
}
