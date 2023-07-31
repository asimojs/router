
export interface Router<NavState = any> {
    readonly currentRoute: Route;
    init(navState: NavState, baseURL: string, pr?: Router, w?: UrlAccessor): Promise<void>;
    add(routeDict: { [routePattern: RoutePattern]: NavController<NavState> | NavControllerLoad<NavState> | DeferredControllerDef<NavState> }): void;
    remove(routePattern: string): boolean;
    navigate(path: string, replace?: boolean, scrollIntoView?: boolean): Promise<void>;
}

/**
 * Route definition identifier
 * unique string to compare routes and get best match (doesn't compare params) - e.g. "/records/ / ?"
 */
export type RouteId = string;

/**  Route definition pattern - e.g. "/records/:genreId/:bandId?#" */
export type RoutePattern = string;

/** Route definition - e.g. /records/:genreId/:bandId?# */
export interface RouteDef<NavState = any> {
    /** Route Definition identifier */
    id: RouteId;
    /** Route definition pattern */
    pattern: string;
    /**
     * Tell if route contains parameter
     * e.g. true in "/records/jazz/coltrane?title=spiral#start"
     */
    containsParams: boolean;
    /**
     * Tell if the route contains hash parameters
     * e.g. true "/records/jazz/coltrane?title=spiral#start"
     */
    containsHashParam: boolean;
    /**
     * Normalized route path
     * e.g. ["records"," "," "] - item can be either a name or a space (for variables) or "*" for anything else
     */
    normalizedPath: string[];
    /**
     * Path variables array
     * e.g. [ "", "genreId", "bandId" ]
     */
    pathVariables: string[] | null;
    /**
     * Tell if this route is the default for a given path
     * true if last path element is '*'
     */
    isDefault: boolean;
    /**  Navigation controller associated to this route */
    controllerFactory?: DeferredControllerDef<NavState>;
    /** Current nav controller instance (if running) */
    controller?: NavController;
}

/** Route instance - e.g. /records/jazz/coltrane?title=spiral#start */
export interface Route {
    /** the route path, as in the url e.g. "/foo/bar/baz" */
    path: string;
    /** route path as array - e.g. ["foo","bar","baz"] */
    pathList: any;
    /** params in the url path */
    pathParams: null | { [name: string]: string };
    /** params in the query string - i.e. after the ? */
    params: null | { [name: string]: string };
    /** params in the hash - i.e. the value after # */
    hashParam: null | string;
    /** associated RouteDef id */
    routeId: RouteId;
    /** associated RouteDef pattern */
    pattern: RoutePattern;
}

/** Navigation controller */
export interface NavController<NavState = any> {
    /** Callback called when a route is loaded */
    load: NavControllerLoad<NavState>;
    /** Callback called when a route is unloaded */
    unload?(r: Route, navState: NavState): void;
    /** Tell if a route can be loaded when coming from a given route */
    canNavigateFrom?(dest: Route, navState: NavState): boolean;
    /** Tell if a route can be loaded */
    canNavigateTo?(dest: Route, navState: NavState): boolean;
    /** Callback called when the controller is disposed */
    dispose?(): void;
}

/**
 * Function called when a route is loaded
 */
export interface NavControllerLoad<NavState> {
    (r: Route, navState: NavState): void | Promise<void>;
}

export interface NavControllerFactory<NavState> {
    (): Promise<NavController<NavState>>;
}

export interface DeferredControllerDef<NavState> {
    deferred: true;
    /**
     * Function that returns a NavController (sync or async)
     */
    (rc: RouteContext<NavState>): NavController<NavState> | Promise<NavController<NavState>>;
}

export interface RouteContext<NavState = any> {
    parentRouteDef: RouteDef<NavState>;
    router: Router;
}

/**
 * Subset of the window API used by the router
 */
export interface UrlAccessor {
    location: { href: string };
    history: {
        pushState(state: any, title: string, url: string): void;
        replaceState(state: any, title: string, url: string): void;
    };
    addEventListener(type: string, listener: (e: any) => void): void;
}
