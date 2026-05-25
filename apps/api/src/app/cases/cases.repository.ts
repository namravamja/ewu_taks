import { Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginationArgs } from '@mediastar/shared';
import { DatabaseService, Prisma } from '@mediastar/database';
import { type CasesQueryDTO } from './dtos';
import {
  CASE_DISPLAY_PROPERTIES,
  type CaseDisplayPropertyKey,
  type ICaseDisplayProperty,
  type ICaseDisplayResult,
  ICaseMutationResult,
  ICreateCaseRequest,
  IGroupedCasesByStage,
  IUpdateCaseRequest,
} from './interfaces/case.interface';
import { buildCasesWhere } from './utils/cases-filter.util';
import { buildCasesOrderBy } from './utils/cases-order.util';

const CASE_MUTATION_SELECT = {
  id: true,
  subjectName: true,
  age: true,
  incidentType: true,
  incidentDate: true,
  caseSummary: true,
  address911: true,
  callTime911: true,
  state: true,
  city: true,
  zip: true,
  arrestDate: true,

  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      type: true,
      status: true,
    },
  },

  stageId: true,

  stage: {
    select: {
      id: true,
      stageTitle: true,
      caseCount: true,
    },
  },

  dueDate: true,
  createdAt: true,
  casePriority: true,
  caseSource: true,
  priority: true,
} satisfies Prisma.CaseSelect;

const DEFAULT_STAGE_TITLE = 'New';

@Injectable()
export class CaseRepository {
  constructor(private readonly db: DatabaseService) {}

  private toDisplayCase(
    caseRecord: ICaseMutationResult,
    displayProperties: CaseDisplayPropertyKey[],
  ): ICaseDisplayResult {
    return displayProperties.reduce<ICaseDisplayResult>((displayCase, property) => {
      if (property === 'id') {
        displayCase.id = caseRecord.id;
      }

      if (property === 'subjectName') {
        displayCase.subjectName = caseRecord.subjectName;
      }

      if (property === 'age') {
        displayCase.age = caseRecord.age;
      }

      if (property === 'incidentType') {
        displayCase.incidentType = caseRecord.incidentType;
      }

      if (property === 'incidentDate') {
        displayCase.incidentDate = caseRecord.incidentDate;
      }

      if (property === 'caseSummary') {
        displayCase.caseSummary = caseRecord.caseSummary;
      }

      if (property === 'address911') {
        displayCase.address911 = caseRecord.address911;
      }

      if (property === 'callTime911') {
        displayCase.callTime911 = caseRecord.callTime911;
      }

      if (property === 'state') {
        displayCase.state = caseRecord.state;
      }

      if (property === 'city') {
        displayCase.city = caseRecord.city;
      }

      if (property === 'zip') {
        displayCase.zip = caseRecord.zip;
      }

      if (property === 'arrestDate') {
        displayCase.arrestDate = caseRecord.arrestDate;
      }

      if (property === 'assignee') {
        displayCase.assignee = caseRecord.assignee;
      }

      if (property === 'stageId') {
        displayCase.stageId = caseRecord.stageId;
      }

      if (property === 'stage') {
        displayCase.stage = caseRecord.stage;
      }

      if (property === 'dueDate') {
        displayCase.dueDate = caseRecord.dueDate;
      }

      if (property === 'casePriority') {
        displayCase.casePriority = caseRecord.casePriority;
      }

      if (property === 'caseSource') {
        displayCase.caseSource = caseRecord.caseSource;

      }

      if (property === 'createdAt') {
        displayCase.createdAt = caseRecord.createdAt;
      }

      if (property === 'priority') {
        displayCase.priority = caseRecord.priority;
      }

      return displayCase;
    }, {});
  }

  public async findById(id: string): Promise<ICaseMutationResult | null> {
    return this.db.case.findUnique({
      where: { id },
      select: CASE_MUTATION_SELECT,
    }) as Promise<ICaseMutationResult | null>;
  }

  public async findMany(
    query: CasesQueryDTO,
  ): Promise<[ICaseMutationResult[], number]> {
    const { skip, take } = buildPaginationArgs(query);
    const where = buildCasesWhere(query);

    const [data, total] = await Promise.all([
      this.db.case.findMany({
        where,
        select: CASE_MUTATION_SELECT,
        skip,
        take,
        orderBy: { id: query.sort ?? 'desc' },
      }),
      this.db.case.count({ where }),
    ]);

    return [data as ICaseMutationResult[], total];
  }

  public async getAllCasesByAllStages(
    query: CasesQueryDTO,
  ): Promise<[IGroupedCasesByStage[], number]> {
    const { skip, take } = buildPaginationArgs(query);
    const caseLimit = query.caseLimit ?? take;
    const displayProperties = query.displayPropertiesFilter?.length
      ? query.displayPropertiesFilter
      : CASE_DISPLAY_PROPERTIES.filter((property) => property.selected).map((property) => property.key);

    const [stagesWithCases, total, stageCounts] = await Promise.all([
      this.db.stages.findMany({
        select: {
          id: true,
          stageTitle: true,
          caseCount: true,
          case: {
            select: CASE_MUTATION_SELECT,
            take: caseLimit,
            where: buildCasesWhere(query),
            orderBy: buildCasesOrderBy(query.orderBy, query.sort ?? 'desc'),
          },
        },
        skip,
        take,
        orderBy: { id: query.sort ?? 'desc' },
      }),
      this.db.stages.count(),
      this.db.case.groupBy({
        by: ['stageId'],
        where: buildCasesWhere(query),
        _count: {
          _all: true,
        },
      }),
    ]);

    const caseCountByStageId = new Map<number | null, number>(
      stageCounts.map((group) => [group.stageId, group._count._all]),
    );

    return [
      stagesWithCases.map((stage) => ({
        stageId: stage.id,
        stageTitle: stage.stageTitle,
        caseCount: caseCountByStageId.get(stage.id) ?? 0,
        cases: (stage.case as ICaseMutationResult[]).map((caseRecord) =>
          this.toDisplayCase(caseRecord, displayProperties),
        ),
      })),
      total,
    ];
  }

  public async stageExists(stageId: number): Promise<boolean> {
    const stage = await this.db.stages.findUnique({
      where: { id: stageId },
      select: { id: true },
    });

    return Boolean(stage);
  }

  public async moveCaseToStage(caseId: string, stageId: number): Promise<ICaseMutationResult> {
    const oldCase = await this.db.case.findUnique({ where: { id: caseId }, select: { stageId: true } });
    if (oldCase?.stageId && oldCase.stageId !== stageId) {
      await this.db.$transaction([
        this.db.stages.update({ where: { id: oldCase.stageId }, data: { caseCount: { decrement: 1 } } }),
        this.db.stages.update({ where: { id: stageId }, data: { caseCount: { increment: 1 } } }),
        this.db.case.update({
          where: { id: caseId },
          data: { stageId },
        })
      ]);
    } else if (!oldCase?.stageId) {
      await this.db.$transaction([
        this.db.stages.update({ where: { id: stageId }, data: { caseCount: { increment: 1 } } }),
        this.db.case.update({
          where: { id: caseId },
          data: { stageId },
        })
      ]);
    }
    return this.findById(caseId) as Promise<ICaseMutationResult>;
  }

  public async create(params: ICreateCaseRequest): Promise<ICaseMutationResult> {
    const assigneeIds = [...new Set(params.assigneeIds)];
    const assignees = await this.db.user.findMany({
      where: {
        id: {
          in: assigneeIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (assignees.length !== assigneeIds.length) {
      throw new NotFoundException('One or more assignees were not found');
    }

    const selectedStage =
      params.stageId != null
        ? await this.db.stages.findUnique({
            where: { id: params.stageId },
            select: { id: true },
          })
        : await this.db.stages.findFirst({
            where: { stageTitle: { equals: DEFAULT_STAGE_TITLE, mode: 'insensitive' } },
            select: { id: true },
          });

    const stage =
      selectedStage ??
      (await this.db.stages.create({
        data: { stageTitle: DEFAULT_STAGE_TITLE, caseCount: 0 },
        select: { id: true },
      }));

    await this.db.stages.update({
      where: { id: stage.id },
      data: { caseCount: { increment: 1 } },
    });

    return this.db.case.create({
      data: {
        subjectName: params.subjectName,
        age: params.age,
        incidentType: params.incidentType,
        incidentDate: params.incidentDate,
        caseSummary: params.caseSummary,
        address911: params.address911,
        callTime911: params.callTime911,
        state: params.state,
        city: params.city,
        zip: params.zip,
        arrestDate: params.arrestDate,
        assignee: {
          connect: assigneeIds.map((id) => ({ id })),
        },
        stage: {
          connect: { id: stage.id },
        },
        dueDate: params.dueDate,
        casePriority: params.casePriority,
        caseSource: params.caseSource,
        priority: params.priority,
      },
      select: CASE_MUTATION_SELECT,
    }) as Promise<ICaseMutationResult>;
  }

  public async update(id: string, params: IUpdateCaseRequest): Promise<ICaseMutationResult> {
    const oldCase = await this.db.case.findUnique({ where: { id }, select: { stageId: true } });
    let assigneeSet: Array<{ id: number }> | undefined;
    if (params.assigneeIds !== undefined) {
      const assigneeIds = [...new Set(params.assigneeIds)];
      const assignees = await this.db.user.findMany({
        where: {
          id: {
            in: assigneeIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (assignees.length !== assigneeIds.length) {
        throw new NotFoundException('One or more assignees were not found');
      }

      assigneeSet = assigneeIds.map((assigneeId) => ({ id: assigneeId }));
    }

    if (params.stageId !== undefined && params.stageId !== null) {
      const stage = await this.db.stages.findUnique({
        where: { id: params.stageId },
        select: { id: true },
      });

      if (!stage) {
        throw new NotFoundException('Stage not found');
      }
    }

    const updatedCase = await this.db.case.update({
      where: { id },
      data: {
        ...(params.subjectName !== undefined && { subjectName: params.subjectName }),
        ...(params.age !== undefined && { age: params.age }),
        ...(params.incidentType !== undefined && { incidentType: params.incidentType }),
        ...(params.incidentDate !== undefined && { incidentDate: params.incidentDate }),
        ...(params.caseSummary !== undefined && { caseSummary: params.caseSummary }),
        ...(params.address911 !== undefined && { address911: params.address911 }),
        ...(params.callTime911 !== undefined && { callTime911: params.callTime911 }),
        ...(params.state !== undefined && { state: params.state }),
        ...(params.city !== undefined && { city: params.city }),
        ...(params.zip !== undefined && { zip: params.zip }),
        ...(params.arrestDate !== undefined && { arrestDate: params.arrestDate }),
        ...(params.dueDate !== undefined && { dueDate: params.dueDate }),
        ...(params.casePriority !== undefined && { casePriority: params.casePriority }),
        ...(params.caseSource !== undefined && { caseSource: params.caseSource }),
        ...(params.priority !== undefined && { priority: params.priority }),
        ...(assigneeSet !== undefined && { assignee: { set: assigneeSet } }),
        ...(params.stageId !== undefined &&
          (params.stageId === null
            ? { stage: { disconnect: true } }
            : { stage: { connect: { id: params.stageId } } })),
      },
      select: CASE_MUTATION_SELECT,
    }) as unknown as ICaseMutationResult;

    if (oldCase && oldCase.stageId !== updatedCase.stageId) {
      if (oldCase.stageId) {
        await this.db.stages.update({ where: { id: oldCase.stageId }, data: { caseCount: { decrement: 1 } } });
      }
      if (updatedCase.stageId) {
        await this.db.stages.update({ where: { id: updatedCase.stageId }, data: { caseCount: { increment: 1 } } });
      }
      return this.findById(id) as Promise<ICaseMutationResult>;
    }

    return updatedCase;
  }

  public async delete(id: string): Promise<ICaseMutationResult> {
    const deletedCase = await this.db.case.delete({
      where: { id },
      select: CASE_MUTATION_SELECT,
    }) as unknown as ICaseMutationResult;
    if (deletedCase.stageId) {
      await this.db.stages.update({
        where: { id: deletedCase.stageId },
        data: { caseCount: { decrement: 1 } },
      });
    }
    return deletedCase;
  }

  public async displayPropertiesFilter(): Promise<ICaseDisplayProperty[]> {
    return [...CASE_DISPLAY_PROPERTIES];
  }

  public async prTeamFilter(pr_team?: string[]): Promise<Prisma.CaseWhereInput | undefined> {
    if (!pr_team || pr_team.length === 0) {
      return undefined;
    }

    return {
    };
  }
}
