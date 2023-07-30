
export function _createRouter() {
    return {
        init(rootPath?: string): void {

        }
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
