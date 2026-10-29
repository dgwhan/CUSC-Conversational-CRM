import { Injectable } from "@nestjs/common";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (needsPasswordUpgrade(hash)) {
        return bcrypt.compare(password, hash);
    }
    return argon2.verify(hash, password);
}

export function needsPasswordUpgrade(hash: string): boolean {
    return hash.startsWith("$2");
}

@Injectable()
export class PasswordService {
    /**
     * Băm mật khẩu sử dụng thuật toán Argon2id chuẩn bảo mật cao.
     */
    async hash(password: string): Promise<string> {
        return hashPassword(password);
    }

    /**
     * Xác thực mật khẩu:
     * - Hỗ trợ Argon2 (mặc định)
     * - Tương thích ngược với hash cũ bằng Bcrypt (bắt đầu bằng $2)
     */
    async verify(password: string, hash: string): Promise<boolean> {
        return verifyPassword(password, hash);
    }

    /**
     * Kiểm tra hash có cần nâng cấp không (ví dụ hash bcrypt cũ sang argon2).
     */
    needsUpgrade(hash: string): boolean {
        return needsPasswordUpgrade(hash);
    }

    /**
     * Xác thực mật khẩu và tự động tạo hash Argon2 mới nếu hash hiện tại là bcrypt cũ.
     */
    async verifyAndUpgrade(
        password: string,
        hash: string,
    ): Promise<{ isValid: boolean; upgradedHash?: string }> {
        const isLegacy = this.needsUpgrade(hash);
        const isValid = isLegacy
            ? await bcrypt.compare(password, hash)
            : await argon2.verify(hash, password);

        if (!isValid) {
            return { isValid: false };
        }

        const upgradedHash = isLegacy ? await this.hash(password) : undefined;
        return { isValid: true, upgradedHash };
    }
}
