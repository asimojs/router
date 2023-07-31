import { beforeEach, describe, expect, it } from 'vitest';
import { RouterImpl, _createRouter, routeDef } from '../core';
import { NavController, DeferredControllerDef, Route, RouteContext, Router, UrlAccessor } from '../types';

interface TestNavState {
    logs: string[];
}

describe('Router', () => {
    let r: RouterImpl<TestNavState>;

    let ctrlCount = 0;
    const ctrlAFactory = routeDef<TestNavState>(() => {
        let current = "", id = ctrlCount++;
        return {
            async load(dest: Route, state) {
                state.logs.push(`[navCtrlA ${id}] load: ${dest.path}(${dest.pattern})${current}`);
                current = "<-" + dest.path;
            },
            canNavigateTo(dest: Route, state) {
                state.logs.push(`[navCtrlA ${id}] canNavigateTo: ${dest.path}(${dest.pattern})${current}`);
                return true;
            }
        }
    });



    let authorizeFromB = true, authorizeToB = true;
    const ctrlBFactory = routeDef<TestNavState>(() => {
        let current = "", id = ctrlCount++;
        return {
            load(dest: Route, state) {
                state.logs.push(`[navCtrlB ${id}] load: ${dest.path}(${dest.pattern})${current}`);
                current = "<-" + dest.path;
            },
            unload(dest: Route, state) {
                state.logs.push(`[navCtrlB ${id}] unload: ${dest.path}(${dest.pattern})${current}`);
                current = "";
            },
            canNavigateTo(dest: Route, state) {
                state.logs.push(`[navCtrlB ${id}] canNavigateTo: ${dest.path}(${dest.pattern})${current}`);
                return authorizeToB;
            },
            canNavigateFrom(dest: Route, state) {
                state.logs.push(`[navCtrlB ${id}] canNavigateFrom: ${dest.path}(${dest.pattern})${current}`);
                return authorizeFromB;
            }
        }
    });

    let lastParentRoute = "";

    const navState: TestNavState = {
        logs: []
    };

    const ri1 = {
        pattern: "/a/b/c",
        isDefault: false,
        containsHashParam: false,
        containsParams: false,
        normalizedPath: ["a", "b", "c"],
        id: "/a/b/c",
        pathVariables: null,
        controllerFactory: ctrlAFactory
    }, ri2 = {
        pattern: "/:x/*",
        isDefault: true,
        containsHashParam: false,
        containsParams: false,
        normalizedPath: [" ", "*"],
        id: "/ /*",
        pathVariables: ["x", "*"],
        controllerFactory: ctrlAFactory
    }, ri3 = {
        pattern: "/a/:b",
        isDefault: false,
        containsHashParam: false,
        containsParams: false,
        normalizedPath: ["a", " "],
        id: "/a/ ",
        pathVariables: ["", "b"],
        controllerFactory: ctrlAFactory
    }, ri4 = {
        pattern: "/*",
        isDefault: false,
        containsHashParam: false,
        containsParams: false,
        normalizedPath: ["*"],
        id: "/*",
        pathVariables: ["*"],
        controllerFactory: ctrlAFactory
    };

    function getUrlAccessor(href: string) {
        return {
            addEventListener(type: string, cb: (e: any) => void) {
                //console.log("addEventListener");
            },
            location: {
                href: href
            },
            history: {
                _state: [],
                pushState(state: any, title: string, url: string) {
                    let st = this._state as any[];
                    st.push(state);
                    st.push("title");
                    st.push(url);
                },
                replaceState(state: any, title: string, url: string) {
                    let st = this._state as any[];
                    if (st.length > 2) {
                        st[st.length - 3] = state;
                        st[st.length - 2] = title;
                        st[st.length - 1] = url;
                    }
                }
            }
        }
    }

    beforeEach(() => {
        r = _createRouter();
        lastParentRoute = "";
        ctrlCount = 0;
        navState.logs = [];
        authorizeFromB = true;
        authorizeToB = true;
    });

    describe('Basics', () => {
        it('should parse routes', async () => {
            expect(r.parseRoute("/a/bbb/c")).toMatchObject({
                pattern: "/a/bbb/c",
                isDefault: false,
                containsHashParam: false,
                containsParams: false,
                normalizedPath: ["a", "bbb", "c"],
                id: "/a/bbb/c",
                pathVariables: null
            });

            expect(r.parseRoute("/")).toMatchObject({
                pattern: "/",
                isDefault: false,
                containsHashParam: false,
                containsParams: false,
                normalizedPath: [],
                id: "/",
                pathVariables: null
            });

            expect(r.parseRoute("/:foo/blah/:bar?")).toMatchObject({
                pattern: "/:foo/blah/:bar?",
                isDefault: false,
                containsHashParam: false,
                containsParams: true,
                normalizedPath: [" ", "blah", " "],
                id: "/ /blah/ ?",
                pathVariables: ["foo", "", "bar"]
            });

            expect(r.parseRoute("/hello/:bar?#")).toMatchObject({
                pattern: "/hello/:bar?#",
                isDefault: false,
                containsHashParam: true,
                containsParams: true,
                normalizedPath: ["hello", " "],
                id: "/hello/ ?#",
                pathVariables: ["", "bar"]
            });

            expect(r.parseRoute("/:v1/xyz#")).toMatchObject({
                pattern: "/:v1/xyz#",
                isDefault: false,
                containsHashParam: true,
                containsParams: false,
                normalizedPath: [" ", "xyz"],
                id: "/ /xyz#",
                pathVariables: ["v1", ""]
            });

            expect(r.parseRoute("/*")).toMatchObject({
                pattern: "/*",
                isDefault: true,
                containsHashParam: false,
                containsParams: false,
                normalizedPath: ["*"],
                id: "/*",
                pathVariables: ["*"]
            });

            expect(r.parseRoute("/records/*?#")).toMatchObject({
                pattern: "/records/*?#",
                isDefault: true,
                containsHashParam: true,
                containsParams: true,
                normalizedPath: ["records", "*"],
                id: "/records/*?#",
                pathVariables: ["", "*"]
            });

            expect(r.parseRoute("/a/:var/b")).toMatchObject({
                pattern: "/a/:var/b",
                isDefault: false,
                containsHashParam: false,
                containsParams: false,
                normalizedPath: ["a", " ", "b"],
                id: "/a/ /b",
                pathVariables: ["", "var", ""]
            });
        });

        it("should support adding and removing routes dynamically", function () {
            r.add({
                "/a/b/c": ctrlAFactory,
                "/:x/*": ctrlAFactory
            });

            expect(r.routeTree).toMatchObject({
                "a": {
                    "b": {
                        "c": ri1
                    }
                },
                " ": {
                    "*": ri2
                }
            });

            r.add({
                "/a/:b": ctrlAFactory
            });

            expect(r.routeTree).toMatchObject({
                "a": {
                    "b": {
                        "c": ri1
                    },
                    " ": ri3
                },
                " ": {
                    "*": ri2
                }
            });

            let res = r.remove("/a/b/c");
            expect(res).toBe(true);
            expect(r.routeTree).toMatchObject({
                "a": {
                    "b": undefined,
                    " ": ri3
                },
                " ": {
                    "*": ri2
                }
            });

            res = r.remove("/:x/*");
            expect(res).toBe(true);
            expect(r.routeTree).toMatchObject({
                "a": {
                    "b": undefined,
                    " ": ri3
                },
                " ": undefined
            });

            res = r.remove("/a/:b");
            expect(res).toBe(true);
            expect(r.routeTree).toMatchObject({
                "a": undefined,
                " ": undefined
            });

        });

        it("should be able to find routes for a given url", async function () {
            r.add({
                "/a/b/c": ctrlAFactory,
                "/:x/+": ctrlAFactory,
                "/a/:b": ctrlAFactory,
                "/*": ctrlAFactory
            });

            let rt = r.getRoute("/a/b/c");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/a/b/c");

            rt = r.getRoute("/foo");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/*");

            rt = r.getRoute("/foo/bar/baz#123");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/ /+");

            rt = r.getRoute("/a/bar");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/a/ ");
            expect(rt?.pathParams).toMatchObject({ b: 'bar' });

            rt = r.getRoute("/foo/x");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/ /+");

            rt = r.getRoute("/42/2");
            expect(rt).not.toBe(null);
            expect(rt?.routeId).toBe("/ /+");
            expect(rt?.pathParams).toMatchObject({ x: '42', '+': '2' });
        });
    });

    describe('Hash routes', () => {
        it("should perform simple navigation and check guards (default)", async function () {
            r.add({
                "/*": ctrlAFactory,
                "/:x/+": ctrlBFactory
            });

            expect(r.currentRoute.routeId).toBe("");
            const w = getUrlAccessor("https://foo.bar.com:8080");
            await r.init(navState, "#", undefined, w); // baseURL = "#" for hash urls

            expect(navState.logs).toMatchObject([
                "[navCtrlA 0] canNavigateTo: /(/*)",
                "[navCtrlA 0] load: /(/*)"
            ]);

            expect(r.currentRoute).toMatchObject({
                path: "/",
                pathList: [""],
                hashParam: null,
                params: null,
                pathParams: { "*": "" },
                pattern: "/*",
                routeId: "/*"
            });

            expect(w.history["_state"].length).toBe(0);

            navState.logs = [];
            await r.navigate("/foo/bar");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 1] canNavigateTo: /foo/bar(/:x/+)",
                "[navCtrlB 1] load: /foo/bar(/:x/+)"
            ]);
            expect(r.currentRoute).toMatchObject({
                path: "/foo/bar",
                pathList: ["foo", "bar"],
                hashParam: null,
                params: null,
                pathParams: { x: "foo", "+": "bar" },
                pattern: "/:x/+",
                routeId: "/ /+"
            });
            expect(w.history["_state"].length).toBe(3);
            expect(w.history["_state"][2]).toBe("#/foo/bar");

            navState.logs = [];
            await r.navigate("/aa/bb/cc#foo");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 1] canNavigateFrom: /aa/bb/cc#foo(/:x/+)<-/foo/bar",
                "[navCtrlB 1] canNavigateTo: /aa/bb/cc#foo(/:x/+)<-/foo/bar",
                "[navCtrlB 1] unload: /aa/bb/cc#foo(/:x/+)<-/foo/bar",
                "[navCtrlB 1] load: /aa/bb/cc#foo(/:x/+)"
            ]);

            let currentRoute = {
                path: "/aa/bb/cc#foo",
                pathList: ["aa", "bb", "cc"],
                hashParam: "foo",
                params: null,
                pathParams: { x: "aa", "+": "bb/cc" },
                pattern: "/:x/+",
                routeId: "/ /+"
            }
            expect(r.currentRoute).toMatchObject(currentRoute);

            navState.logs = [];
            authorizeFromB = false;
            await r.navigate("/hello/world");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 1] canNavigateFrom: /hello/world(/:x/+)<-/aa/bb/cc#foo"
            ]);
            expect(r.currentRoute).toMatchObject(currentRoute);

            navState.logs = [];
            authorizeFromB = true;
            authorizeToB = false;
            await r.navigate("/hello/world2");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 1] canNavigateFrom: /hello/world2(/:x/+)<-/aa/bb/cc#foo",
                "[navCtrlB 1] canNavigateTo: /hello/world2(/:x/+)<-/aa/bb/cc#foo"
            ]);
            expect(r.currentRoute).toMatchObject(currentRoute);

            navState.logs = [];
            authorizeToB = true;
            await r.navigate("/hello-world");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 1] canNavigateFrom: /hello-world(/*)<-/aa/bb/cc#foo",
                "[navCtrlA 0] canNavigateTo: /hello-world(/*)<-/",
                "[navCtrlB 1] unload: /hello-world(/*)<-/aa/bb/cc#foo",
                "[navCtrlA 0] load: /hello-world(/*)<-/"
            ]);
            expect(r.currentRoute).toMatchObject({
                path: "/hello-world",
                pathList: ["hello-world"],
                hashParam: null,
                params: null,
                pathParams: { "*": "hello-world" },
                pattern: "/*",
                routeId: "/*"
            });
        });

        it("should perform simple navigation and check guards", async function () {
            r.add({
                "/*": ctrlAFactory,
                "/:x/+": ctrlBFactory,
                "/a/*": (dest: Route, state) => {
                    state.logs.push("[Inline Load] " + dest.path);
                }
            });

            expect(r.currentRoute.routeId).toBe("");
            const w = getUrlAccessor("https://foo.bar.com:8080/#foo/bar");
            await r.init(navState, "#", undefined, w); // baseURL = "#" for hash urls

            expect(navState.logs).toMatchObject([
                "[navCtrlB 0] canNavigateTo: /foo/bar(/:x/+)",
                "[navCtrlB 0] load: /foo/bar(/:x/+)"
            ]);
            expect(r.currentRoute).toMatchObject({
                path: "/foo/bar",
                pathList: ["foo", "bar"],
                hashParam: null,
                params: null,
                pathParams: { x: "foo", "+": "bar" },
                pattern: "/:x/+",
                routeId: "/ /+"
            });

            navState.logs = [];
            await r.navigate("/a");
            expect(navState.logs).toMatchObject([
                "[navCtrlB 0] canNavigateFrom: /a(/a/*)<-/foo/bar",
                "[navCtrlB 0] unload: /a(/a/*)<-/foo/bar",
                "[Inline Load] /a"
            ]);
            expect(r.currentRoute).toMatchObject({
                path: "/a",
                pathList: ["a"],
                hashParam: null,
                params: null,
                pathParams: { "*": "" },
                pattern: "/a/*",
                routeId: "/a/*"
            });
        });
    });

    // TODO html5 routes

});
