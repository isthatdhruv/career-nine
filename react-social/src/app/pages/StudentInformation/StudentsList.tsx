import React, { useEffect, useState } from "react";
import { Search, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";

interface Member {
  id: number;
  name: string;
  tasks: number;
  roles: string[];
  location: string;
  status: string;
  activity: string;
  avatar: string;
}

interface SortConfig {
  key: keyof Member | null;
  direction: "asc" | "desc";
}

export default function TeamMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: null, 
    direction: "asc" 
  });

  useEffect(() => {
    const sampleData: Member[] = [
      { id: 1, name: "Floyd Miles", tasks: 43, roles: ["Chat", "Tester"], location: "Ukraine", status: "Active", activity: "Today, 11:45 am", avatar: "FM" },
      { id: 2, name: "Devon Lane", tasks: 91, roles: ["Visitor", "Developer"], location: "India", status: "Deleted", activity: "Month ago", avatar: "DL" },
      { id: 3, name: "Ronald Richards", tasks: 78, roles: ["Designer", "Analyst"], location: "France", status: "Active", activity: "Week ago", avatar: "RR" },
      { id: 4, name: "Kathryn Murphy", tasks: 85, roles: ["Admin", "Scrum Master"], location: "Japan", status: "Pending", activity: "Today, 4:00 pm", avatar: "KM" },
      { id: 5, name: "Jacob Smith", tasks: 92, roles: ["Support", "Developer"], location: "South Korea", status: "Deleted", activity: "Week ago", avatar: "JS" },
      { id: 6, name: "Kristin Watson", tasks: 102, roles: ["Chat", "Visitor"], location: "Italy", status: "Active", activity: "Today, 8:00 am", avatar: "KW" },
      { id: 7, name: "Cameron Williamson", tasks: 58, roles: ["Admin", "Analyst"], location: "Russia", status: "Pending", activity: "2 days ago", avatar: "CW" },
      { id: 8, name: "Courtney Henry", tasks: 75, roles: ["Designer", "Support"], location: "Spain", status: "Active", activity: "Month ago", avatar: "CH" },
      { id: 9, name: "Ralph Edwards", tasks: 109, roles: ["Admin", "Scrum Master"], location: "Canada", status: "Deleted", activity: "Week ago", avatar: "RE" },
      { id: 10, name: "Arlene McCoy", tasks: 84, roles: ["Support", "Developer"], location: "Malaysia", status: "Active", activity: "Today, 1:00 pm", avatar: "AM" },
    ];
    setMembers(sampleData);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700";
      case "Deleted":
        return "bg-red-100 text-red-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCountryFlag = (country: string): string => {
    const flags: Record<string, string> = {
      Ukraine: "🇺🇦",
      India: "🇮🇳",
      France: "🇫🇷",
      Japan: "🇯🇵",
      "South Korea": "🇰🇷",
      Italy: "🇮🇹",
      Russia: "🇷🇺",
      Spain: "🇪🇸",
      Canada: "🇨🇦",
      Malaysia: "🇲🇾",
    };
    return flags[country] || "🌍";
  };

  const filteredMembers = members.filter((member: Member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = !activeOnly || member.status === "Active";
    return matchesSearch && matchesActive;
  });

  const sortedMembers = [...filteredMembers].sort((a: Member, b: Member) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = sortedMembers.slice(startIndex, endIndex);

  const handleSort = (key: keyof Member) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Team Members({members.length})
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Overview of all team members and roles.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium">
                Import Members
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Add Member
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Active Users</span>
                <label className="relative inline-block w-11 h-6">
                  <input
                    type="checkbox"
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left w-12">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th 
                    onClick={() => handleSort("name")} 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Member ↕
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th 
                    onClick={() => handleSort("location")} 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Location ↕
                  </th>
                  <th 
                    onClick={() => handleSort("status")} 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Status ↕
                  </th>
                  <th 
                    onClick={() => handleSort("activity")} 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Recent activity ↕
                  </th>
                  <th className="px-6 py-3 text-left w-12"></th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {currentMembers.map((member: Member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm">
                          {member.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.tasks} tasks</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {member.roles.map((role: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-900">
                        <span className="mr-2">{getCountryFlag(member.location)}</span>
                        <span>{member.location}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-md text-sm font-medium inline-block ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {member.activity}
                    </td>

                    <td className="px-6 py-4">
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show</span>
              <select 
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {startIndex + 1}-{Math.min(endIndex, sortedMembers.length)} of {sortedMembers.length}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500 px-2">...</span>
                {[...Array(Math.min(4, totalPages))].map((_, i) => {
                  const pageNum = currentPage <= 2 ? i + 1 : currentPage + i - 1;
                  if (pageNum > totalPages) return null;
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentPage === pageNum 
                          ? "bg-blue-600 text-white" 
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button 
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}