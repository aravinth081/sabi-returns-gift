 import React, { useState } from "react";
import { 
  Home, User, FileText, LogOut, Bell, Plus, Download, Eye, Pencil, Trash2, MapPin, Clock, Users, Droplet 
} from "lucide-react";

// Initial Table Data
const initialUsers = [
  { id: 1, name: "Aravinth", phone: "9876543210", bloodGroup: "A+", location: "Chennai, TN" },
  { id: 2, name: "Kumar", phone: "8765432109", bloodGroup: "O-", location: "Madurai, TN" },
  { id: 3, name: "Suresh", phone: "7654321098", bloodGroup: "B+", location: "Coimbatore, TN" }
];

export default function Index() {
  const [users, setUsers] = useState(initialUsers);
  
  // Modals States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Form Data State
  const [formData, setFormData] = useState({ id: null as any, name: "", phone: "", bloodGroup: "", location: "" });
  const [previewData, setPreviewData] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddClick = () => {
    setFormData({ id: null, name: "", phone: "", bloodGroup: "", location: "" });
    setIsModalOpen(true);
  };

  const handleEditClick = (user: any) => {
    setFormData(user);
    setIsModalOpen(true);
  };

  const handlePreviewClick = (user: any) => {
    setPreviewData(user);
    setIsPreviewOpen(true);
  };

  const handleDeleteClick = (id: any) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter(user => user.id !== id));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id) {
      setUsers(users.map(u => (u.id === formData.id ? formData : u)));
    } else {
      const newUser = { ...formData, id: Date.now() };
      setUsers([...users, newUser]);
    }
    setIsModalOpen(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* ------------------- SIDEBAR ------------------- */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex print:hidden">
        <div>
          <div className="p-6 flex flex-col items-center border-b border-gray-100">
            <div className="w-20 h-20 bg-gray-200 rounded-full mb-3 flex items-center justify-center overflow-hidden border-2 border-red-100">
              <User size={40} className="text-gray-400" />
            </div>
            <h2 className="font-semibold text-lg text-gray-800">Aravinth</h2>
            <span className="text-xs text-red-500 font-medium bg-red-50 px-3 py-1 rounded-full mt-1 border border-red-100">
              Admin
            </span>
          </div>

          <nav className="p-4 space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 rounded-lg font-medium transition-colors border border-red-100">
              <Home size={20} /> Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
              <User size={20} /> User Management
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
              <FileText size={20} /> Reports
            </a>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button className="flex items-center gap-3 px-4 py-3 text-gray-600 w-full hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </aside>

      {/* ------------------- MAIN CONTENT AREA ------------------- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm z-10 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome Back, Aravinth!</h1>
            <p className="text-gray-500 text-sm">Here is what's happening today in your donation hub.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 bg-gray-100 rounded-full relative hover:bg-gray-200">
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center border border-gray-300">
               <User size={20} className="text-gray-500" />
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          
          {/* STAT CARDS (Re-added as you requested) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:hidden">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between border-l-4 border-l-red-500">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Request Matches</p>
                <h3 className="text-2xl font-bold text-gray-800">12</h3>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <MapPin className="text-red-500" size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between border-l-4 border-l-orange-500">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Pending Requests</p>
                <h3 className="text-2xl font-bold text-gray-800">5</h3>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                <Clock className="text-orange-500" size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Total Donors</p>
                <h3 className="text-2xl font-bold text-gray-800">{users.length}</h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Users className="text-blue-500" size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between border-l-4 border-l-green-500">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Pending Donations</p>
                <h3 className="text-2xl font-bold text-gray-800">2</h3>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <Droplet className="text-green-500" size={24} />
              </div>
            </div>
          </div>

          {/* DATA TABLE SECTION */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Customer Records</h2>
              <div className="flex gap-3 print:hidden">
                <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-200">
                  <Download size={18} /> Export PDF
                </button>
                <button onClick={handleAddClick} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                  <Plus size={18} /> Add User
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Phone Number</th>
                    <th className="p-4 font-semibold">Blood Group</th>
                    <th className="p-4 font-semibold">Location</th>
                    <th className="p-4 font-semibold text-center print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">No data found. Click "Add User" to create one.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-medium text-gray-800">{user.name}</td>
                        <td className="p-4 text-gray-600">{user.phone}</td>
                        <td className="p-4">
                          <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                            {user.bloodGroup}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600">{user.location}</td>
                        <td className="p-4 flex justify-center gap-2 print:hidden">
                          <button onClick={() => handlePreviewClick(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Preview">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => handleEditClick(user)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Edit">
                            <Pencil size={18} />
                          </button>
                          <button onClick={() => handleDeleteClick(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: ADD / EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {formData.id ? "Edit User Details" : "Add New User"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Enter Name"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input required type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Enter Phone Number"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select required name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none">
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option> <option value="O+">O+</option> <option value="B+">B+</option>
                  <option value="AB+">AB+</option> <option value="A-">A-</option> <option value="O-">O-</option>
                  <option value="B-">B-</option> <option value="AB-">AB-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input required type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g. Chennai, TN"/>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW */}
      {isPreviewOpen && previewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center border border-gray-200">
              <User size={40} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{previewData.name}</h2>
            <p className="text-gray-500 font-medium mb-6">{previewData.phone}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Blood Group</span>
                <span className="font-bold text-red-600 bg-red-100 px-3 py-1 rounded-md">{previewData.bloodGroup}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Location</span>
                <span className="font-medium text-gray-800 flex items-center gap-1"><MapPin size={16} className="text-gray-400"/> {previewData.location}</span>
              </div>
            </div>

            <button onClick={() => setIsPreviewOpen(false)} className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">
              Close Preview
            </button>
          </div>
        </div>
      )}

    </div>
  );
}