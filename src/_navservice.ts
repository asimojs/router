// Asidemo navservice - for the record

// import { asm } from "@asimojs/asimo";
// import { Store, trax } from "@traxjs/trax";
// import { NavService, NavServiceIID, ViewId } from "./types";


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


// const routes: ViewId[] = [
//     "",
//     "team",
//     "tasks",
//     "404"
// ]

// /**
//  * NavService maintains the navigation data
//  * @returns the NavService instance
//  */
// export function _createNavService(): NavService {
//     return trax.createStore("NavService", (store: Store<NavService["data"]>) => {
//         const data = store.init({
//             view: "loading",
//             services: {}
//         }, {
//             init: function* (d, cc) {
//                 cc.maxComputeCount = 1; // run only once
//                 // determine first view from location
//                 const { id, invalidPath404 } = getViewId();
//                 loadView(id, invalidPath404);
//             }
//         });

//         function loadView(id: ViewId, invalidPath404?: string, pushHistory = false) {
//             if (id === "tasks") {
//                 document.title = "Asimo demo - tasks";
//             } else if (id === "team") {
//                 document.title = "Asimo demo - team";
//             } else {
//                 document.title = "Asimo demo";
//             }
//             data.view = id;
//             data.invalidPath404 = (id === "404") ? invalidPath404 : "";

//             let args = "";
//             const queryArgsMatch = window.location.href.match(/(\#|\?).*$/);
//             args = queryArgsMatch && queryArgsMatch[0] || args;
//             pushHistory && window.history.pushState({}, "", rootPath + id + args);
//         }

//         window.onpopstate = () => {
//             // react to browser history change (back/fwd/url path change)
//             const { id, invalidPath404 } = getViewId();
//             loadView(id, invalidPath404);
//         }

//         return {
//             data,
//             navigate(dest?: ViewId, event?: Event): void {
//                 // prevent default if event is provided
//                 event && event.preventDefault();
//                 loadView(dest || "", "", true);
//             }
//         }
//     });
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

// asm.registerService(NavServiceIID, _createNavService);
