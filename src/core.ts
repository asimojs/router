import { NavController, DeferredControllerDef, RouteDef, RoutePattern, Router, Route, UrlAccessor, NavControllerLoad, NavControllerFactory, RouteContext } from "./types";

export interface RouterImpl<NavState = any> extends Router<NavState> {
    readonly routeTree: RouteTree;
    readonly pageUrl: string;
    parseRoute(routePattern: string): RouteDef<NavState>;
    getRoute(url: string): Route | null;
}

export interface RouteTree {
    [pathElt: string]: RouteTree | RouteDef<any> | undefined;
}



interface UrlData {
    path: string[];
    containsParams: boolean;
    containsHashParam: boolean;
    hashParam: string;
    params: { [name: string]: string } | null;
}

const U = undefined,
    RX_PATH_VAR = /^\:([a-zA-Z_\$]\w*)$/i,    // e.g. :index in /records/:index
    RX_PATH_ELT = /^([^\/\*\+\s]+)$/i,        // e.g.foo in /foo/bar
    RX_HASH_START = /^([^\#]*)\#?/,           // e.g. /# or # or /foo/bar/#
    RX_PARAM_SEPARATOR = /\;|\&/,             // i.e. ; or &
    RX_PARAM_KV = /^([^\=]*)\=(.*)$/i,        // e.g. foo=123
    RX_URL_ARGS = /(\?|\#).+$/gi,             // e.g. #foo or ?a=b#bar
    RX_HREF_START = /^[^\/]*\/\/[^\/]*/;      // e.g. https://foo.bar.org:8080


export function routeDef<NavState>(f: (rc: RouteContext<NavState>) => NavController<NavState> | Promise<NavController<NavState>>): DeferredControllerDef<NavState> {
    (f as any).deferred = true;
    return f as DeferredControllerDef<NavState>;
}

export function _createRouter<NavState>(): RouterImpl<NavState> {
    let routeDefs: { [pattern: string]: RouteDef | undefined } = {};
    let routeTree: RouteTree = {};
    let currentRoute: Route = {
        path: "",
        pathList: [],
        pathParams: null,
        params: null,
        hashParam: null,
        routeId: "",
        pattern: ""
    };
    let parent: Router | null = null;
    let initialized = false;
    let navState: NavState;
    let pageUrl = "";
    let baseUrl = "";
    let win: UrlAccessor;

    const router = {
        get routeTree(): RouteTree {
            return routeTree;
        },

        get currentRoute(): Route {
            return currentRoute;
        },

        get pageUrl(): string {
            return pageUrl;
        },

        async init(state: any, baseURL: string, pr?: Router, w?: UrlAccessor) {
            // read and split url according to baseUrl
            if (initialized) return;
            initialized = true;
            navState = state;
            baseUrl = baseURL;
            win = w || window;
            if (pr) {
                parent = pr;
            }

            // get route url
            let url = win.location.href.replace(RX_HREF_START, "");
            if (win.location.href.match(RX_HASH_START)) {
                pageUrl = RegExp.$1;
            }
            if (baseUrl === "#") {
                if (url.indexOf("#") > -1) {
                    url = url.replace(RX_HASH_START, "");
                } else {
                    url = "";
                }
                checkUrlStart();
            } else {
                let bl = baseUrl.length;
                if (url.slice(0, bl) !== baseUrl) {
                    error(`Url doesn't match baseUrl\nbaseUrl: ${baseUrl}\nUrl: ${url}`);
                } else {
                    url = url.slice(bl);
                    checkUrlStart();
                }
            }
            let r = navigate(url, 2);

            if (!parent) {
                win.addEventListener("popstate", (e: any) => {
                    if (e.state && e.state.url !== U) {
                        navigate(e.state.url, 0);
                    }
                });
                win.addEventListener("click", (e: any) => {
                    handleLinkClick(e.target, this);
                });
            }

            return await r;

            function checkUrlStart() {
                if (url.charAt(0) !== "/") {
                    url = "/" + url;
                }
            }
        },

        parseRoute(pattern: string): RouteDef {
            const normalizedPath: string[] = [], pathVariables: string[] = [];
            let routeId = "", hasPathVariable = false, acceptsParams = false, acceptsHashParam = false, varDict: { [name: string]: 1 } = {}, isDefault = false;

            const p = pattern.split("/"), len = p.length;
            if (len === 0 || p[0] !== "") {
                err("Invalid syntax: route pattern must start with '/'");
            } else {
                let pathElt: string, lastElt = p[len - 1], idx = 0;
                idx = lastElt.indexOf("?");
                if (idx > -1) {
                    p[len - 1] = lastElt.slice(0, idx);
                    acceptsParams = true;
                    lastElt = lastElt.slice(idx + 1);
                    if (lastElt === "#") {
                        acceptsHashParam = true;
                    } else if (lastElt !== "") {
                        err("Invalid syntax: route cannot end with '?" + lastElt + "'");
                    }
                } else {
                    idx = lastElt.indexOf("#");
                    if (idx > -1) {
                        p[len - 1] = lastElt.slice(0, idx);
                        acceptsHashParam = true;
                        lastElt = lastElt.slice(idx + 1);
                        if (lastElt !== "") {
                            err("Invalid syntax: route cannot end with '#" + lastElt + "'");
                        }
                    }
                }

                let nm = "";
                for (let i = 1; len > i; i++) {
                    pathElt = p[i];
                    if (pathElt.match(RX_PATH_VAR)) {
                        // path element is a variable - e.g. ":varName"
                        hasPathVariable = true;
                        nm = RegExp.$1;
                        if (varDict[nm] === 1) {
                            err("Duplicate variable name: '" + nm + "'");
                        }
                        varDict[nm] = 1;
                        pathVariables[i - 1] = nm;
                        normalizedPath[i - 1] = " ";
                    } else if (pathElt.match(RX_PATH_ELT)) {
                        pathVariables[i - 1] = "";
                        normalizedPath[i - 1] = pathElt;
                    } else if (pathElt === "*" || pathElt === "+") {
                        isDefault = true;
                        normalizedPath[i - 1] = pathElt;
                        hasPathVariable = true;
                        pathVariables[i - 1] = pathElt;
                        if (i !== len - 1) {
                            err("Invalid route: '" + pathElt + "' can only be used on last path element");
                        }
                    } else if (i !== len - 1 || pathElt !== "") {
                        err("Invalid path element: '" + pathElt + "'");
                    }
                }
                routeId = "/" + normalizedPath.join("/") + (acceptsParams ? "?" : "") + (acceptsHashParam ? "#" : "");
            }

            return {
                pattern: pattern,
                containsParams: acceptsParams,
                containsHashParam: acceptsHashParam,
                id: routeId,
                normalizedPath: normalizedPath,
                pathVariables: hasPathVariable ? pathVariables : null,
                isDefault: isDefault
            }

            function err(msg: string) {
                error(msg + "\nRoute: '" + pattern + "'");
            }
        },

        add(routeDict: { [routePattern: RoutePattern]: NavController<NavState> | NavControllerLoad<NavState> | DeferredControllerDef<NavState> }) {
            for (let k in routeDict) {
                if (routeDict.hasOwnProperty(k)) {
                    addRoute(this.parseRoute(k), routeDict[k]);
                }
            }
        },

        remove(routePattern: string): boolean {
            let ri = this.parseRoute(routePattern);
            const r = routeDefs[ri.id] as RouteDef;
            if (r === U) return false; // route is not defined
            let p = ri.normalizedPath, stack: RouteTree[] = [this.routeTree], t = this.routeTree;
            for (let i = 0; p.length > i; i++) {
                if (i < p.length - 1) {
                    t = t[p[i]] as RouteTree;
                    stack.push(t);
                } else {
                    // last elt
                    t[p[i]] = undefined;
                }
            }
            if (stack.length > 1) {
                for (let i = stack.length - 1; i > 0; i--) {
                    t = stack[i]!;
                    if (isEmpty(t)) {
                        stack[i - 1][p[i - 1]] = U;
                    } else {
                        break;
                    }
                }
            }
            routeDefs[ri.id] = U;
            if (r.controller !== U && r.controller !== null && r.controller.dispose) {
                r.controller.dispose();
                r.controller = U;
            }
            return true;

            function isEmpty(t: RouteTree): boolean {
                for (let k in t) {
                    if (t.hasOwnProperty(k) && t[k] !== U) return false;
                }
                return true;
            }
        },

        getRoute(path: string): Route | null {
            // path: the part of the url after the baseUrl
            const urlInfo = splitPath(path, err), p = urlInfo.path, len = p.length, pathParams: (string | number)[] = [];
            let t = this.routeTree, v: any, defaultSymbol = "*", stack: any[] = [t];
            for (let i = 0; len > i; i++) {
                v = t[p[i]];
                if (v === U) {
                    // not found: check for route with variable if path is not empty
                    if (p[i] !== "") {
                        v = t[" "];
                        if (v !== U) {
                            pathParams.push(i);
                            pathParams.push(p[i]);
                        }
                    }
                    if (v === U) {
                        // check for default route
                        if (checkDefaultRoute(t["*"], t["+"], p[i])) {
                            return buildRoute(true, i, 1); // found
                        }
                    }
                }
                if (v === U) {
                    return buildDefaultRoute();
                }
                if (i === len - 1) {
                    if (v.normalizedPath !== U) {
                        return buildRoute(false, i, 2); // found
                    } else {
                        // v is a RouteTree: check for a default handler otherwise no match
                        if (checkDefaultRoute(v["*"], v["+"], "")) {
                            return buildRoute(true, i + 1, 3); // found
                        }
                        let r = buildDefaultRoute();
                        if (r !== null) {
                            return r;
                        }
                        err("Incomplete URL");
                    }
                } else {
                    if (v.normalizedPath === U) {
                        // v is a RouteTree: expected case
                        t = v as RouteTree;
                        stack.push(t);
                    } else {
                        // v is a route but we are not at the end of the path
                        err("Unsupported URL");
                    }
                }
            }

            return null;

            function findParentDefault() {
                let j = stack.length - 1;
                while (j > -1) {
                    let t = stack[j];
                    if (t["*"]) {
                        return j;
                    } else {
                        j--;
                    }
                }
                return -1;
            }

            function buildDefaultRoute() {
                let idx = findParentDefault();
                if (idx > -1) {
                    v = stack[idx]["*"];
                    return buildRoute(true, idx, 4);
                }
                return null;
            }

            function buildRoute(isDefault: boolean, idx: number, src: number): Route {
                const ri = v as RouteDef;
                let pp: any = null, pathString = "/" + p.join("/");
                if (pathParams.length > 0 && ri.pathVariables !== null) {
                    pp = {};
                    for (let i = 0; pathParams.length > i; i += 2) {
                        let key: any = pathParams[i];
                        if (ri.pathVariables[key] !== U) {
                            pp[ri.pathVariables[key]] = pathParams[i + 1];
                        }
                    }
                }
                if (isDefault) {
                    if (pp === null) pp = {};
                    let p2 = p.slice(idx);
                    pp[defaultSymbol] = p2.join("/").replace(RX_URL_ARGS, "");
                }
                if (pp !== null || urlInfo.containsHashParam) {
                    p[p.length - 1] = p[p.length - 1].replace(RX_URL_ARGS, "");
                }
                return {
                    path: pathString,
                    pathList: p,
                    pathParams: pp,
                    params: urlInfo.params,
                    hashParam: urlInfo.containsHashParam ? urlInfo.hashParam : null,
                    routeId: ri.id,
                    pattern: ri.pattern
                }
            }

            function checkDefaultRoute(starValue: any, plusValue: any, pathElt: string) {
                if (pathElt === "") {
                    v = starValue;
                } else {
                    v = plusValue || starValue;
                    defaultSymbol = plusValue ? "+" : "*";
                }
                if (v !== U && v.normalizedPath !== U) {
                    return true;
                }

                return false;
            }

            function err(msg: string) {
                error(msg + "\nURL: '" + path + "'");
            }
        },

        async navigate(path: string, replace = false, scrollIntoView = true) {
            await navigate(path, replace ? 2 : 1, scrollIntoView);
        }

    }

    return router;

    function error(msg: string, route?: RouteDef) {
        console.log("ROUTER " + msg);
    }

    function addRoute(rd: RouteDef, cld: NavController<NavState> | NavControllerLoad<NavState> | DeferredControllerDef<NavState>) {
        if (routeDefs[rd.id] !== U) {
            error("Route cannot be defined twice: '" + rd.pattern + "'", routeDefs[rd.id]);
        }
        // register in route dictionary
        routeDefs[rd.id] = rd;
        // register in route tree
        let p = rd.normalizedPath, t = routeTree, pe: string, len = p.length;
        for (let i = 0; len > i; i++) {
            pe = p[i]; // path elt
            if (t[pe] === U) {
                if (i === len - 1) {
                    t[pe] = rd;
                } else {
                    t = t[pe] = {}; // new tree
                }
            } else {
                if (t[pe]!.pattern !== U) {
                    // this route is already defined
                    error("Route cannot be defined twice: '" + rd.pattern + "'", t[pe] as RouteDef);
                } else {
                    t = t[pe] as RouteTree;
                }
            }
        }

        if (typeof cld === "function") {
            if ((cld as any)["deferred"]) {
                // cld is a DeferredControllerDef
                rd.controllerFactory = cld as DeferredControllerDef<NavState>;
            } else {
                // cld is NavControllerLoad
                rd.controller = {
                    load: cld as NavControllerLoad<NavState>
                }
            }
        } else {
            // cld is a NavController
            if (typeof (cld as any).load === "function") {
                rd.controller = cld as NavController;
            } else {
                error("Invalid route controller", rd);
            }
        }
    }

    /**
     * Scan a url to get a normalized structure
     * @param url the url without the domain and protocol information (e.g. "/" or "/foo/bar?x=123#blah")
     */
    function splitPath(url: string, err: (msg: string) => void): UrlData {
        let containsParams = false, containsHashParam = false, hashParam: string = "", p = "";

        const path = url.split("/"), len = path.length, params: { [name: string]: string } = {};
        if (len === 0 || path[0] !== "") {
            err("Invalid syntax: url must start with '/'");
        } else {
            let lastElt = path[len - 1], idx = 0;
            idx = lastElt.indexOf("?");
            if (idx > -1) {
                path[len - 1] = lastElt.slice(0, idx);
                containsParams = true;
                p = lastElt.slice(idx + 1); // e.g. "foo=123;bar=234#blah"
            } else {
                p = lastElt; // e.g. "foo#blah"
            }
            if (p !== "") {
                idx = p.indexOf("#");
                if (idx > -1) {
                    containsHashParam = true;
                    hashParam = p.slice(idx + 1);
                    p = p.slice(0, idx);
                }
            }
            if (containsParams) {
                // parse params
                let ps = p.split(RX_PARAM_SEPARATOR);
                for (let chunk of ps) {
                    if (chunk.match(RX_PARAM_KV)) {
                        params[RegExp.$1] = RegExp.$2;
                    } else {
                        error("Invalid parameter: " + chunk);
                    }
                }
            }
        }
        if (path.length > 1) {
            // remove the first empty path element (unless path is actually empty, in which case we keep it)
            path.splice(0, 1);
        }

        return {
            path: path,
            containsParams: containsParams,
            containsHashParam: containsHashParam,
            hashParam: hashParam,
            params: containsParams ? params : null
        }
    }

    async function navigate(path: string, pushState: 0 | 1 | 2 = 1, scrollIntoView = true) {
        // pushState 0=no push 1=push 2=replace
        if (!win) error("Router not initialized: navigation is not possible");
        if (path.indexOf("#") === 0) {
            // authorize paths starting with a #
            path = path.slice(1);
        }
        // path: the part of the url after the baseUrl
        let route = router.getRoute(path), crc: NavController | undefined;
        if (route === null) return;

        // check if navigation is authorized
        if (currentRoute.routeId !== "") {
            crc = routeDefs[currentRoute.routeId]!.controller!;
            if (crc.canNavigateFrom !== U && !crc.canNavigateFrom(route, navState)) return;
        }

        let rDef: RouteDef | null = routeDefs[route.routeId]!;
        while (rDef !== null && rDef.controller === U) {
            let res: NavController;
            // retrieve NavController (if sync load) or Route | null (if async load)
            const factory = rDef.controllerFactory! as DeferredControllerDef<NavState>;

            res = (await factory({ parentRouteDef: rDef, router }));

            // if ((rDef.controllerFactory! as NavControllerFactory).createController !== U) {
            //     res = await (rDef.controllerFactory! as NavControllerFactory).createController(rDef, path);
            // } else {
            //     console.log("TODO retrieveRoute")
            //     // res = await (rDef.controllerFactory! as RouteRetriever).retrieveRoute(rDef, path);
            // }
            if (!res) {
                error('Invalid DeferredControllerDef', rDef);
            } else {
                if (typeof (res as any)["load"] === "function") {
                    // res is a NavController
                    rDef.controller = res as NavController;
                } else {
                    console.log("TODODODO")
                }
            }

            // if (res !== null && typeof res["load"] === "function") {
            //     // res is a NavController
            //     rDef.controller = res as NavController;
            // } else {
            //     if (res === null) {
            //         rDef = null; // route not found
            //     } else {
            //         r = res as any as Route; // TODO
            //         rDef = routeDefs[r.routeId]!;
            //     }
            // }
        }
        if (!rDef) return;
        const newRouteCtrl = rDef.controller!;

        if (newRouteCtrl.canNavigateTo !== U && !newRouteCtrl.canNavigateTo(route, navState)) return;
        // unload previous view and load new one in parallel
        if (crc !== U && crc.unload !== U) {
            crc.unload(route, navState);
        }

        const cr = currentRoute;
        cr.hashParam = route.hashParam;
        cr.params = route.params;
        cr.path = route.path;
        cr.pathList = route.pathList;
        cr.pathParams = route.pathParams;
        cr.pattern = route.pattern;
        cr.routeId = route.routeId;
        await newRouteCtrl.load(route, navState);

        if (pushState !== 0) {
            let url = baseUrl === "#" ? "#" + route.path : route.path;

            if (pushState === 1) {
                // console.log("history.pushState", r.path)
                win.history.pushState({ url: route.path }, "", url);
            } else {
                // console.log("history.replaceState", r.path)
                win.history.replaceState({ url: route.path }, "", url);
            }
        }
        if (scrollIntoView) {
            let doc = (win as any)["document"] as any;
            if (doc) {
                doc.body.scrollIntoView();
            }
        }
    }

    function handleLinkClick(elt: any, router: RouterImpl) {
        let path = findRouterUrl(elt, router.pageUrl);
        if (path !== null) {
            // console.log("link navigation: ", path);
            router.navigate(path);
        }
    }

    function findRouterUrl(elt: any, pageUrl: string): string | null {
        if (elt === U || elt === null || elt.tagName === "HTML") return null;
        if (elt.tagName === "A" && pageUrl !== "") {
            const href: string = elt.href;
            if (href.slice(0, pageUrl.length) === pageUrl) {
                return href.slice(pageUrl.length);
            }
        }
        return findRouterUrl(elt.parentElement, pageUrl);
    }
}



// let rootPath = "/"; // must end with "/"
// // determine base path
// // e.g. /dist/ in /dist/team
// const pathName = window.location.pathname;
// if (pathName.length > 1) {
//     const p = pathName.slice(1);
//     const idx = p.indexOf("/");
//     if (idx > -1) {
//         rootPath = pathName.slice(0, idx + 2);
//         console.log('%crootPath: %s', 'color:#2d7bf0', rootPath);
//     }
// }

// /** Main views */
// export type ViewId = "tasks" | "team" | "" | "404";


// function loadView(id: ViewId, invalidPath404?: string, pushHistory = false) {
//     if (id === "tasks") {
//         document.title = "Asimo demo - tasks";
//     } else if (id === "team") {
//         document.title = "Asimo demo - team";
//     } else {
//         document.title = "Asimo demo";
//     }
//     data.view = id;
//     data.invalidPath404 = (id === "404") ? invalidPath404 : "";

//     let args = "";
//     const queryArgsMatch = window.location.href.match(/(\#|\?).*$/);
//     args = queryArgsMatch && queryArgsMatch[0] || args;
//     pushHistory && window.history.pushState({}, "", rootPath + id + args);
// }

// const routes: ViewId[] = [
//     "",
//     "team",
//     "tasks",
//     "404"
// ]

// window.onpopstate = () => {
//     // react to browser history change (back/fwd/url path change)
//     const { id, invalidPath404 } = getViewId();
//     loadView(id, invalidPath404);
// }

// /**
//  * Determine the current view from the application url
//  * TODO: use a better router
//  */
// function getViewId(): { id: ViewId, invalidPath404?: string } {
//     const path = window.location.pathname;
//     if (path.slice(0, rootPath.length) !== rootPath) {
//         console.error(`[navservice] Invalid root path: ${path.slice(0, rootPath.length)}"`);
//         return { id: "404", invalidPath404: path };
//     }

//     let viewPath = path.slice(rootPath.length);
//     viewPath = viewPath.replace(/\/*$/g, ""); // remove last "/" if any
//     if (routes.includes(viewPath as ViewId)) {
//         return { id: viewPath as ViewId };
//     }
//     return { id: "404", invalidPath404: viewPath };
// }
