/**
 * 知音楼 Agent 工具集 — 考勤打卡
 *
 * 参考实现：/vol2/1000/docker/yach-attendance
 * 纯 JS 重写，不依赖 Python 子进程。
 *
 * 工具列表：
 *   yach_punch_on_duty    — 上班打卡
 *   yach_punch_off_duty   — 下班打卡
 *   yach_attendance_auth_check — 打卡认证状态检查
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
/** ⭐ 上班打卡 */
export declare const yachPunchOnDuty: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        latitude: Type.TNumber;
        longitude: Type.TNumber;
        deviceId: Type.TString;
        deviceName: Type.TString;
        deviceBrand: Type.TOptional<Type.TString>;
        deviceModel: Type.TOptional<Type.TString>;
        deviceVersion: Type.TOptional<Type.TString>;
        networkType: Type.TOptional<Type.TString>;
        systemVersion: Type.TOptional<Type.TString>;
        platform: Type.TOptional<Type.TString>;
        clientVersion: Type.TOptional<Type.TString>;
        clientRelease: Type.TOptional<Type.TString>;
        force: Type.TOptional<Type.TBoolean>;
        address: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ⭐ 下班打卡 */
export declare const yachPunchOffDuty: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        latitude: Type.TNumber;
        longitude: Type.TNumber;
        deviceId: Type.TString;
        deviceName: Type.TString;
        deviceBrand: Type.TOptional<Type.TString>;
        deviceModel: Type.TOptional<Type.TString>;
        deviceVersion: Type.TOptional<Type.TString>;
        networkType: Type.TOptional<Type.TString>;
        systemVersion: Type.TOptional<Type.TString>;
        platform: Type.TOptional<Type.TString>;
        clientVersion: Type.TOptional<Type.TString>;
        clientRelease: Type.TOptional<Type.TString>;
        force: Type.TOptional<Type.TBoolean>;
        address: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ⭐ 打卡认证状态检查 */
export declare const yachAttendanceAuthCheck: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        latitude: Type.TNumber;
        longitude: Type.TNumber;
        deviceId: Type.TString;
        deviceName: Type.TString;
        deviceBrand: Type.TOptional<Type.TString>;
        deviceModel: Type.TOptional<Type.TString>;
        deviceVersion: Type.TOptional<Type.TString>;
        networkType: Type.TOptional<Type.TString>;
        systemVersion: Type.TOptional<Type.TString>;
        platform: Type.TOptional<Type.TString>;
        clientVersion: Type.TOptional<Type.TString>;
        clientRelease: Type.TOptional<Type.TString>;
        force: Type.TOptional<Type.TBoolean>;
        address: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch25-attendance.d.ts.map
