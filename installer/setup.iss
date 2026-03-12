; Timberborn Tool — Inno Setup Script
; Compile with: iscc installer/setup.iss

#define TimberbornToolName "Timberborn Tool"
#define TimberbornToolVersion GetEnv("TIMBERBORN_TOOL_VERSION")
#if TimberbornToolVersion == ""
  #define TimberbornToolVersion "0.0.0-dev"
#endif
#define TimberbornToolPublisher "clevergrant"
#define TimberbornToolURL "https://github.com/clevergrant/beaver-tool"
#define TimberbornToolExeName "beavers.cmd"

[Setup]
AppId={{E7A3F2B1-9C4D-4E6F-8A1B-3D5C7E9F0A2B}
AppName={#TimberbornToolName}
AppVersion={#TimberbornToolVersion}
AppPublisher={#TimberbornToolPublisher}
AppPublisherURL={#TimberbornToolURL}
AppSupportURL={#TimberbornToolURL}
DefaultDirName={localappdata}\TimberbornTool
DefaultGroupName={#TimberbornToolName}
DisableProgramGroupPage=yes
OutputDir=..\output
OutputBaseFilename=TimberbornTool-Setup-{#TimberbornToolVersion}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ChangesEnvironment=yes
; SetupIconFile=..\assets\icon.ico  ; uncomment when you have a .ico file

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{cm:UninstallProgram,{#TimberbornToolName}}"; Filename: "{uninstallexe}"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  Path: string;
  AppDir: string;
begin
  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', Path);
    if Pos(AppDir, Path) = 0 then
    begin
      if Path <> '' then
        Path := Path + ';';
      Path := Path + AppDir;
      RegWriteStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', Path);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Path: string;
  AppDir: string;
  P: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    AppDir := ExpandConstant('{app}');
    RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', Path);
    P := Pos(AppDir, Path);
    if P > 0 then
    begin
      Delete(Path, P, Length(AppDir));
      { Remove trailing or leading semicolon }
      if (P > 1) and (Path[P - 1] = ';') then
        Delete(Path, P - 1, 1)
      else if (P <= Length(Path)) and (Path[P] = ';') then
        Delete(Path, P, 1);
      RegWriteStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', Path);
    end;
  end;
end;
