import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

export class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema: ZodType) { }
    transform(value: unknown, metadata: ArgumentMetadata) {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            //return only safe validation details, raw Zod issues may contain input data
            const errors = result.error.issues.map((issue) => ({
                path: issue.path,
                message: issue.message,
            }));

            throw new BadRequestException({
                message: "Invalid request",
                errors,
            });
        }

        return result.data;
    }
}
