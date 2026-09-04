let runtime;
export function setYachRuntime(next) {
    runtime = next;
}
export function getYachRuntime() {
    if (!runtime) {
        throw new Error("Yach IM plugin runtime is not available in this registration mode");
    }
    return runtime;
}
//# sourceMappingURL=plugin-runtime.js.map