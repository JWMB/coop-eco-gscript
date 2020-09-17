import { IDriveApp, IFile, IFileIterator, IFolder, IFolderIterator, IIterator } from "./utils-google";

export class MockFileSystemObject {
    protected id: string = "";
    protected name: string = "";
    parents: IFolder[] = [];

    constructor(name?: string) {
        this.name = name || "";
    }
    getId(): string {
        return this.id;
    }
    getName(): string {
        return this.name;
    }
    getParents(): IFolderIterator {
        return new MyIterator<IFolder>(this.parents);
    }
}

export class MockFile extends MockFileSystemObject implements IFile {
    content: any;
    constructor(name?: string, content?: any) {
        super(name);
        this.content = content;
    }
    static create(name: string, info: { content: any, id: (string | null)}): IFile {
        const result = new MockFile(name, null);
        result.id = (info || {}).id || name;
        result.content = (info || {}).content;
        return result;
    }
}

export class MockFolder extends MockFileSystemObject implements IFolder {
    private files: IFile[] = [];
    private folders: IFolder[] = [];
    constructor(name?: string) {
        super(name);
    }
    getFiles(): IFileIterator {
        return new MyIterator<IFile>(this.files);
    }
    addFile(file: IFile): void {
        (<MockFile>file).parents.push(this);
        this.files.push(file);
    }
    removeFile(file: IFile): void {
        this.files.splice(this.files.indexOf(file), 1);
    }
    getFolders(): IFolderIterator {
        return new MyIterator<IFolder>(this.folders);
    }

    addFolder(folder: IFolder) {
        (<MockFolder>folder).parents.push(this);
        this.folders.push(folder);
    }
    static createTree(tree: any, name: string = ""): MockFolder {
        const folder = new MockFolder();
        folder.name = name || tree.name;
        //folder.id = tree.id;
        if (tree.files) {
            Object.keys(tree.files).forEach(k => folder.addFile(MockFile.create(k, tree.files[k])));
        }
        if (tree.folders) {
            Object.keys(tree.folders).forEach(k => folder.addFolder(MockFolder.createTree(tree.folders[k], k)))
        }
        return folder;
    }

    static create(name: string, files: IFile[] = []): MockFolder {
        const result = new MockFolder();
        result.name = name;
        result.files = files;
        return result;
    }
}

class MyIterator<T> implements IIterator<T> {
    private arr: T[] = [];
    private index: number = 0;
    constructor(arr: T[]) {
        this.arr = arr;
    }
    getContinuationToken(): string {
        return "";
    }
    hasNext(): boolean {
        return this.index < this.arr.length;
    }
    next(): T {
        return this.arr[this.index++];
    }
}

export class MockDriveApp implements IDriveApp {
    private root: MockFolder;
    constructor(root: MockFolder) {
        this.root = root;
    }
    private getAllFilesRecursive(node: IFolder, result: IFile[]) {
        const ifiles = node.getFiles();
        while (ifiles.hasNext()) result.push(ifiles.next());

        const ifolders = node.getFolders();
        while (ifolders.hasNext()) this.getAllFilesRecursive(ifolders.next(), result);
    }
    private getAllFoldersRecursive(node: IFolder, result: IFolder[]) {
        const ifolders = node.getFolders();
        while (ifolders.hasNext()) { 
            const f = ifolders.next();
            result.push(f);
            this.getAllFoldersRecursive(f, result);
        }
    }

    createFile(name: string, content: any, mimeType: string): IFile {
        const file = new MockFile(name, content);
        this.root.addFile(file);
        return file;
    }
    createFolder(name: string): IFolder {
        throw new Error("Not implemented");
    }
    getFilesByName(name: string): IFileIterator {
        const result: IFile[] = [];
        this.getAllFilesRecursive(this.root, result);
        return new MyIterator<IFile>(result.filter(f => f.getName() == name));
    }
    getFoldersByName(name: string): IFolderIterator {
        const result: IFolder[] = [];
        this.getAllFoldersRecursive(this.root, result);
        return new MyIterator<IFolder>(result.filter(f => f.getName() == name));
    }
    getFileById(id: string): IFile | null {
        const result: IFile[] = [];
        this.getAllFilesRecursive(this.root, result);
        const filtered = result.filter(f => f.getId() == id);
        return filtered.length > 0 ? filtered[0] : null;
    }
    getRootFolder(): IFolder {
        return this.root;
    }
}